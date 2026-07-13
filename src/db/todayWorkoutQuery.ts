import type { TrainingDatabase } from './database.ts';

export type TodayWorkoutInstance = {
  instanceId: string;
  programWorkoutId: string;
  scheduledDate: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'missed' | 'rescheduled';
  workoutName: string;
  workoutType: string;
  estimatedDurationMin: number | null;
};

export type LastCompletedWorkout = {
  workoutLogId: string;
  workoutName: string;
  completedAt: string;
  totalWorkingSets: number | null;
  totalVolume: number | null;
};

export type LatestExercisePerformance = {
  exerciseId: string;
  weight: number;
  reps: number;
  rpe: number | null;
  completedAt: string | null;
};

export async function getTodayWorkoutInstance(
  db: Pick<TrainingDatabase, 'getFirstAsync'>,
  date: Date | string = new Date(),
): Promise<TodayWorkoutInstance | null> {
  return db.getFirstAsync<TodayWorkoutInstance>(
    `SELECT
       wi.id AS instanceId,
       wi.program_workout_id AS programWorkoutId,
       wi.scheduled_date AS scheduledDate,
       wi.status,
       pw.name AS workoutName,
       pw.workout_type AS workoutType,
       pw.estimated_duration_min AS estimatedDurationMin
     FROM workout_instances wi
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     WHERE wi.scheduled_date = ?
     ORDER BY wi.sequence_index
     LIMIT 1`,
    toIsoDate(date),
  );
}

export async function getNextWorkoutInstance(
  db: Pick<TrainingDatabase, 'getFirstAsync'>,
  date: Date | string = new Date(),
): Promise<TodayWorkoutInstance | null> {
  return db.getFirstAsync<TodayWorkoutInstance>(
    `SELECT
       wi.id AS instanceId,
       wi.program_workout_id AS programWorkoutId,
       wi.scheduled_date AS scheduledDate,
       wi.status,
       pw.name AS workoutName,
       pw.workout_type AS workoutType,
       pw.estimated_duration_min AS estimatedDurationMin
     FROM workout_instances wi
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     WHERE wi.scheduled_date > ?
       AND wi.status IN ('scheduled', 'rescheduled')
       AND pw.workout_type IN ('training', 'test', 'deload', 'taper')
     ORDER BY wi.scheduled_date, wi.sequence_index
     LIMIT 1`,
    toIsoDate(date),
  );
}

export async function getLastCompletedWorkout(
  db: Pick<TrainingDatabase, 'getFirstAsync'>,
): Promise<LastCompletedWorkout | null> {
  return db.getFirstAsync<LastCompletedWorkout>(
    `SELECT
       wl.id AS workoutLogId,
       pw.name AS workoutName,
       wl.completed_at AS completedAt,
       wl.total_working_sets AS totalWorkingSets,
       wl.total_volume AS totalVolume
     FROM workout_logs wl
     JOIN workout_instances wi ON wi.id = wl.workout_instance_id
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     WHERE wl.status = 'completed'
       AND wl.completed_at IS NOT NULL
     ORDER BY wl.completed_at DESC
     LIMIT 1`,
  );
}

export async function getLatestExercisePerformances(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  exerciseIds: readonly string[],
): Promise<LatestExercisePerformance[]> {
  const uniqueExerciseIds = [...new Set(exerciseIds)];
  if (uniqueExerciseIds.length === 0) return [];

  const placeholders = uniqueExerciseIds.map(() => '?').join(', ');
  return db.getAllAsync<LatestExercisePerformance>(
    `SELECT exerciseId, weight, reps, rpe, completedAt
     FROM (
       SELECT
         el.exercise_id AS exerciseId,
         sl.weight,
         sl.reps,
         sl.rpe,
         wl.completed_at AS completedAt,
         ROW_NUMBER() OVER (
           PARTITION BY el.exercise_id
           ORDER BY COALESCE(wl.completed_at, wl.started_at) DESC, sl.set_order DESC
         ) AS rank
       FROM set_logs sl
       JOIN exercise_logs el ON el.id = sl.exercise_log_id
       JOIN workout_logs wl ON wl.id = el.workout_log_id
       WHERE el.exercise_id IN (${placeholders})
         AND sl.is_completed = 1
         AND sl.weight IS NOT NULL
         AND sl.reps IS NOT NULL
     )
     WHERE rank = 1`,
    ...uniqueExerciseIds,
  );
}

function toIsoDate(date: Date | string) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}
