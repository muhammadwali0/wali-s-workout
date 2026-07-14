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
    failed: number;
  };

export type PlannedAnalyticsSet = MuscleExposureSet &
  BlockComparisonSet & {
    completedAt: string;
  };

export type StrengthTrendPoint = {
  exerciseId: string;
  exerciseName: string;
  estimatedOneRm: number;
  unit: 'kg' | 'lb' | null;
  achievedAt: string;
};

export type PlannedVsActualWorkout = {
  instanceId: string;
  workoutName: string;
  scheduledDate: string;
  plannedWorkingSets: number;
  actualWorkingSets: number;
};

export type SessionDurationPoint = {
  workoutLogId: string;
  workoutName: string;
  completedAt: string;
  durationSeconds: number;
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
       sl.rpe,
       sl.is_failed AS failed
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

export async function getPlannedAnalyticsSets(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<PlannedAnalyticsSet[]> {
  return db.getAllAsync<PlannedAnalyticsSet>(
    `WITH RECURSIVE set_numbers(n) AS (
       SELECT 1
       UNION ALL
       SELECT n + 1 FROM set_numbers WHERE n < 20
     )
     SELECT
       wi.scheduled_date || 'T00:00:00Z' AS completedAt,
       pe.exercise_id AS exerciseId,
       pb.block_number AS blockNumber,
       pb.phase_code AS phaseCode,
       psp.set_type AS setType,
       1 AS completed,
       NULL AS weight,
       NULL AS reps
     FROM workout_instances wi
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     JOIN program_weeks pweek ON pweek.id = pw.program_week_id
     JOIN program_blocks pb ON pb.id = pweek.program_block_id
     JOIN program_exercises pe ON pe.program_workout_id = pw.id
     JOIN program_set_prescriptions psp ON psp.program_exercise_id = pe.id
     JOIN set_numbers sn ON sn.n <= psp.target_sets
     ORDER BY wi.scheduled_date, pe.sort_order, psp.set_order, sn.n`,
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

export async function getPlannedVsActualWorkouts(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 8,
): Promise<PlannedVsActualWorkout[]> {
  return db.getAllAsync<PlannedVsActualWorkout>(
    `SELECT
       wi.id AS instanceId,
       pw.name AS workoutName,
       wi.scheduled_date AS scheduledDate,
       COALESCE((
         SELECT SUM(psp.target_sets)
         FROM program_exercises pe
         JOIN program_set_prescriptions psp ON psp.program_exercise_id = pe.id
         WHERE pe.program_workout_id = pw.id
           AND psp.set_type != 'warmup'
       ), 0) AS plannedWorkingSets,
       COALESCE((
         SELECT wl.total_working_sets
         FROM workout_logs wl
         WHERE wl.workout_instance_id = wi.id
         ORDER BY COALESCE(wl.completed_at, wl.started_at, wl.updated_at) DESC
         LIMIT 1
       ), 0) AS actualWorkingSets
     FROM workout_instances wi
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     WHERE wi.status IN ('in_progress', 'completed')
     ORDER BY wi.scheduled_date DESC, wi.sequence_index DESC
     LIMIT ?`,
    limit,
  );
}

export async function getSessionDurationPoints(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 8,
): Promise<SessionDurationPoint[]> {
  return db.getAllAsync<SessionDurationPoint>(
    `SELECT
       wl.id AS workoutLogId,
       pw.name AS workoutName,
       wl.completed_at AS completedAt,
       wl.duration_seconds AS durationSeconds
     FROM workout_logs wl
     JOIN workout_instances wi ON wi.id = wl.workout_instance_id
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     WHERE wl.status = 'completed'
       AND wl.completed_at IS NOT NULL
       AND wl.duration_seconds IS NOT NULL
     ORDER BY wl.completed_at DESC
     LIMIT ?`,
    limit,
  );
}
