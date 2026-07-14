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
