import type { CalendarWorkout } from '../domain/analytics/consistencyCalendar.ts';
import type { BlockComparisonSet } from '../domain/analytics/blockComparison.ts';
import type { MuscleExposureSet } from '../domain/analytics/muscleExposure.ts';
import type { RpeSet } from '../domain/analytics/weeklyRpe.ts';
import type { VolumeSet } from '../domain/analytics/weeklyVolume.ts';
import type { TrainingDatabase } from './database.ts';

export type AnalyticsSet = VolumeSet &
  MuscleExposureSet &
  BlockComparisonSet &
  RpeSet & {
    exerciseCategory: string | null;
  };

export type StrengthTrendPoint = {
  exerciseId: string;
  exerciseName: string;
  estimatedOneRm: number;
  unit: 'kg' | 'lb' | null;
  achievedAt: string;
};

export async function getCompletedAnalyticsSets(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<AnalyticsSet[]> {
  return db.getAllAsync<AnalyticsSet>(
    `SELECT
       wl.completed_at AS completedAt,
       el.exercise_id AS exerciseId,
       e.category AS exerciseCategory,
       pb.block_number AS blockNumber,
       pb.phase_code AS phaseCode,
       sl.set_type AS setType,
       sl.is_completed = 1 AS completed,
       sl.weight AS weight,
       sl.reps AS reps,
       sl.rpe
     FROM set_logs sl
     JOIN exercise_logs el ON el.id = sl.exercise_log_id
     JOIN exercises e ON e.id = el.exercise_id
     JOIN workout_logs wl ON wl.id = el.workout_log_id
     JOIN workout_instances wi ON wi.id = wl.workout_instance_id
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     JOIN program_weeks pweek ON pweek.id = pw.program_week_id
     JOIN program_blocks pb ON pb.id = pweek.program_block_id
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

export async function getEstimatedOneRmTrend(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 10,
): Promise<StrengthTrendPoint[]> {
  return db.getAllAsync<StrengthTrendPoint>(
    `SELECT
       pr.exercise_id AS exerciseId,
       e.name AS exerciseName,
       pr.estimated_1rm AS estimatedOneRm,
       pr.unit,
       pr.achieved_at AS achievedAt
     FROM personal_records pr
     JOIN exercises e ON e.id = pr.exercise_id
     WHERE pr.pr_type = 'estimated_1rm'
       AND pr.estimated_1rm IS NOT NULL
     ORDER BY pr.achieved_at DESC
     LIMIT ?`,
    limit,
  );
}
