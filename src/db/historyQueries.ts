import type { TrainingDatabase } from './database.ts';

export type WorkoutHistoryItem = {
  workoutLogId: string;
  workoutName: string;
  status: 'draft' | 'completed' | 'discarded';
  scheduledDate: string;
  completedAt: string | null;
  durationSeconds: number | null;
  totalVolume: number | null;
  totalWorkingSets: number | null;
  averageRpe: number | null;
  personalRecordCount: number;
  failedSetCount: number;
  lastSetNote: string | null;
};

export type WorkoutHistorySet = {
  setLogId: string;
  exerciseName: string;
  setOrder: number;
  setType: string;
  weight: number | null;
  unit: 'kg' | 'lb';
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  isCompleted: number;
  isFailed: number;
  userNotes: string | null;
};

export async function getRecentWorkoutHistory(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 10,
): Promise<WorkoutHistoryItem[]> {
  return db.getAllAsync<WorkoutHistoryItem>(
    `SELECT
       wl.id AS workoutLogId,
       pw.name AS workoutName,
       wl.status,
       wi.scheduled_date AS scheduledDate,
       wl.completed_at AS completedAt,
       wl.duration_seconds AS durationSeconds,
       wl.total_volume AS totalVolume,
       wl.total_working_sets AS totalWorkingSets,
       wl.average_rpe AS averageRpe,
       (
         SELECT COUNT(*)
         FROM personal_records pr
         WHERE pr.workout_log_id = wl.id
       ) AS personalRecordCount,
       (
         SELECT COUNT(*)
         FROM set_logs sl
         JOIN exercise_logs el ON el.id = sl.exercise_log_id
         WHERE el.workout_log_id = wl.id
           AND sl.is_failed = 1
       ) AS failedSetCount,
       (
         SELECT sl.user_notes
         FROM set_logs sl
         JOIN exercise_logs el ON el.id = sl.exercise_log_id
         WHERE el.workout_log_id = wl.id
           AND sl.user_notes IS NOT NULL
           AND sl.user_notes <> ''
         ORDER BY sl.set_order DESC
         LIMIT 1
       ) AS lastSetNote
     FROM workout_logs wl
     JOIN workout_instances wi ON wi.id = wl.workout_instance_id
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     ORDER BY COALESCE(wl.completed_at, wl.started_at, wi.scheduled_date) DESC
     LIMIT ?`,
    limit,
  );
}

export async function getWorkoutHistorySets(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  workoutLogId: string,
): Promise<WorkoutHistorySet[]> {
  return db.getAllAsync<WorkoutHistorySet>(
    `SELECT
       sl.id AS setLogId,
       e.name AS exerciseName,
       sl.set_order AS setOrder,
       sl.set_type AS setType,
       sl.weight,
       sl.unit,
       sl.reps,
       sl.rpe,
       sl.rir,
       sl.is_completed AS isCompleted,
       sl.is_failed AS isFailed,
       sl.user_notes AS userNotes
     FROM set_logs sl
     JOIN exercise_logs el ON el.id = sl.exercise_log_id
     JOIN exercises e ON e.id = el.exercise_id
     WHERE el.workout_log_id = ?
     ORDER BY el.sort_order, sl.set_order`,
    workoutLogId,
  );
}

export async function updateWorkoutHistorySet(
  db: Pick<TrainingDatabase, 'execAsync' | 'runAsync'>,
  input: {
    workoutLogId: string;
    setLogId: string;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    notes: string | null;
  },
) {
  assertOptionalNonNegative(input.weight, 'weight');
  assertOptionalPositiveInteger(input.reps, 'reps');
  assertOptionalRpe(input.rpe);

  const now = new Date().toISOString();
  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync(
      `UPDATE set_logs
       SET weight = ?,
           reps = ?,
           rpe = ?,
           user_notes = ?,
           updated_at = ?
       WHERE id = ?`,
      input.weight,
      input.reps,
      input.rpe,
      input.notes,
      now,
      input.setLogId,
    );
    await db.runAsync(
      `UPDATE workout_logs
       SET total_volume = (
             SELECT COALESCE(SUM(COALESCE(sl.weight, 0) * COALESCE(sl.reps, 0)), 0)
             FROM set_logs sl
             JOIN exercise_logs el ON el.id = sl.exercise_log_id
             WHERE el.workout_log_id = workout_logs.id
               AND sl.is_completed = 1
               AND sl.is_warmup = 0
           ),
           average_rpe = (
             SELECT AVG(sl.rpe)
             FROM set_logs sl
             JOIN exercise_logs el ON el.id = sl.exercise_log_id
             WHERE el.workout_log_id = workout_logs.id
               AND sl.is_completed = 1
               AND sl.rpe IS NOT NULL
           ),
           updated_at = ?
       WHERE id = ?`,
      now,
      input.workoutLogId,
    );
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

function assertOptionalNonNegative(value: number | null, name: string) {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a non-negative number`);
  }
}

function assertOptionalPositiveInteger(value: number | null, name: string) {
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertOptionalRpe(value: number | null) {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10)) {
    throw new Error('rpe must be between 0 and 10');
  }
}
