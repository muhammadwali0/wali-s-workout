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
       wl.average_rpe AS averageRpe
     FROM workout_logs wl
     JOIN workout_instances wi ON wi.id = wl.workout_instance_id
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     ORDER BY COALESCE(wl.completed_at, wl.started_at, wi.scheduled_date) DESC
     LIMIT ?`,
    limit,
  );
}
