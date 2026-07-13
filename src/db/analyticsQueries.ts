import type { CalendarWorkout } from '../domain/analytics/consistencyCalendar.ts';
import type { MuscleExposureSet } from '../domain/analytics/muscleExposure.ts';
import type { VolumeSet } from '../domain/analytics/weeklyVolume.ts';
import type { TrainingDatabase } from './database.ts';

export type AnalyticsSet = VolumeSet & MuscleExposureSet;

export async function getCompletedAnalyticsSets(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<AnalyticsSet[]> {
  return db.getAllAsync<AnalyticsSet>(
    `SELECT
       wl.completed_at AS completedAt,
       el.exercise_id AS exerciseId,
       sl.set_type AS setType,
       sl.is_completed = 1 AS completed,
       sl.weight AS weight,
       sl.reps AS reps
     FROM set_logs sl
     JOIN exercise_logs el ON el.id = sl.exercise_log_id
     JOIN workout_logs wl ON wl.id = el.workout_log_id
     WHERE sl.is_completed = 1
       AND wl.status = 'completed'
       AND wl.completed_at IS NOT NULL
     ORDER BY wl.completed_at, el.sort_order, sl.set_order`,
  );
}

export async function getCalendarWorkouts(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<CalendarWorkout[]> {
  return db.getAllAsync<CalendarWorkout>(
    `SELECT
       scheduled_date AS scheduledDate,
       status
     FROM workout_instances
     ORDER BY scheduled_date, sequence_index`,
  );
}
