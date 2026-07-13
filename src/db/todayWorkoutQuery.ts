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

function toIsoDate(date: Date | string) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}
