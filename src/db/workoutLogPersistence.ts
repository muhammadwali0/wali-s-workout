import type { TrainingDatabase } from './database.ts';
import type { PlannedSet } from '../domain/workout/sessionPlanner.ts';
import {
  summarizeWorkoutDraft,
  type WorkoutDraft,
} from '../domain/workout/workoutLog.ts';

export type WorkoutLogPersistenceInput = {
  workoutLogId: string;
  workoutInstanceId: string;
  recordedAt: string;
  unit: 'kg' | 'lb';
};

export type WorkoutLogRows = ReturnType<typeof buildWorkoutLogRows>;

export function buildWorkoutLogRows(
  draft: WorkoutDraft,
  input: WorkoutLogPersistenceInput,
) {
  const summary = summarizeWorkoutDraft(draft);
  const plannedById = new Map(draft.plannedSets.map((set) => [set.id, set]));
  const exerciseLogs = getExerciseLogRows(draft.plannedSets, input);
  const exerciseLogByKey = new Map(
    exerciseLogs.map((row) => [`${row.exercise_id}:${row.sort_order}`, row.id]),
  );

  return {
    workoutLog: {
      id: input.workoutLogId,
      workout_instance_id: input.workoutInstanceId,
      started_at: input.recordedAt,
      completed_at: draft.status === 'completed' ? input.recordedAt : null,
      duration_seconds: null,
      status: draft.status,
      average_rpe: summary.averageRpe,
      total_volume: summary.totalVolume,
      total_working_sets: draft.actualSets.filter((set) => {
        const planned = plannedById.get(set.plannedSetId);
        return set.completed && planned?.setType !== 'warmup';
      }).length,
      user_notes: null,
      created_at: input.recordedAt,
      updated_at: input.recordedAt,
    },
    exerciseLogs,
    setLogs: draft.actualSets.map((actual) => {
      const planned = plannedById.get(actual.plannedSetId);
      if (!planned) throw new Error(`Missing planned set: ${actual.plannedSetId}`);

      return {
        id: `${input.workoutLogId}_set_${planned.id}`,
        exercise_log_id:
          exerciseLogByKey.get(`${planned.exerciseId}:${planned.exerciseOrder}`) ??
          `${input.workoutLogId}_exercise_${planned.exerciseOrder}`,
        program_set_prescription_id: null,
        set_order: planned.setNumber,
        set_type: planned.setType,
        weight: actual.weight,
        unit: input.unit,
        reps: actual.reps,
        rpe: actual.rpe,
        rir: null,
        duration_seconds: null,
        is_completed: actual.completed ? 1 : 0,
        is_pr: 0,
        is_warmup: planned.setType === 'warmup' ? 1 : 0,
        is_failed: 0,
        user_notes: actual.notes,
        created_at: input.recordedAt,
        updated_at: input.recordedAt,
      };
    }),
  };
}

export async function saveWorkoutDraft(
  db: TrainingDatabase,
  draft: WorkoutDraft,
  input: WorkoutLogPersistenceInput,
) {
  const rows = buildWorkoutLogRows(draft, input);

  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_logs (
        id, workout_instance_id, started_at, completed_at, duration_seconds, status,
        average_rpe, total_volume, total_working_sets, user_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...Object.values(rows.workoutLog),
    );

    for (const row of rows.exerciseLogs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO exercise_logs (
          id, workout_log_id, program_exercise_id, exercise_id, original_exercise_id,
          was_substituted, substitution_reason, sort_order, status, user_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...Object.values(row),
      );
    }

    for (const row of rows.setLogs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO set_logs (
          id, exercise_log_id, program_set_prescription_id, set_order, set_type,
          weight, unit, reps, rpe, rir, duration_seconds, is_completed, is_pr,
          is_warmup, is_failed, user_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...Object.values(row),
      );
    }

    await db.runAsync(
      `UPDATE workout_instances
       SET status = ?, actual_date = ?, updated_at = ?
       WHERE id = ?`,
      draft.status === 'completed' ? 'completed' : 'in_progress',
      draft.status === 'completed' ? input.recordedAt.slice(0, 10) : null,
      input.recordedAt,
      input.workoutInstanceId,
    );

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

function getExerciseLogRows(
  plannedSets: readonly PlannedSet[],
  input: WorkoutLogPersistenceInput,
) {
  return [
    ...new Map(
      plannedSets.map((set) => [
        `${set.exerciseId}:${set.exerciseOrder}`,
        {
          id: `${input.workoutLogId}_exercise_${set.exerciseOrder}`,
          workout_log_id: input.workoutLogId,
          program_exercise_id: null,
          exercise_id: set.exerciseId,
          original_exercise_id: set.originalExerciseId,
          was_substituted: set.exerciseId === set.originalExerciseId ? 0 : 1,
          substitution_reason: set.substitutionScope,
          sort_order: set.exerciseOrder,
          status: 'pending',
          user_notes: null,
          created_at: input.recordedAt,
          updated_at: input.recordedAt,
        },
      ]),
    ).values(),
  ];
}
