import {
  resolveMissedWorkout,
  type WorkoutInstanceStatus,
} from '../domain/program/missedWorkout.ts';
import type { TrainingDatabase } from './database.ts';

export type MissedWorkoutItem = {
  instanceId: string;
  programWorkoutId: string;
  scheduledDate: string;
  status: WorkoutInstanceStatus;
  wasShifted: number;
  shiftReason: string | null;
  workoutName: string;
};

export async function markOverdueWorkoutsMissed(
  db: Pick<TrainingDatabase, 'runAsync'>,
  date: Date | string = new Date(),
) {
  const today = toIsoDate(date);
  await db.runAsync(
    `UPDATE workout_instances
     SET status = 'missed',
         updated_at = ?
     WHERE scheduled_date < ?
       AND status = 'scheduled'`,
    new Date().toISOString(),
    today,
  );
}

export async function getMissedWorkoutInstances(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<MissedWorkoutItem[]> {
  return db.getAllAsync<MissedWorkoutItem>(
    `SELECT
       wi.id AS instanceId,
       wi.program_workout_id AS programWorkoutId,
       wi.scheduled_date AS scheduledDate,
       wi.status,
       wi.was_shifted AS wasShifted,
       wi.shift_reason AS shiftReason,
       pw.name AS workoutName
     FROM workout_instances wi
     JOIN program_workouts pw ON pw.id = wi.program_workout_id
     WHERE wi.status = 'missed'
     ORDER BY wi.scheduled_date
     LIMIT 10`,
  );
}

export async function resolveMissedWorkoutInstance(
  db: Pick<TrainingDatabase, 'getFirstAsync' | 'runAsync'>,
  instanceId: string,
  resolution:
    | { action: 'skip'; reason?: string }
    | { action: 'do_today_and_shift'; today: string },
) {
  const row = await db.getFirstAsync<MissedWorkoutItem>(
    `SELECT
       id AS instanceId,
       program_workout_id AS programWorkoutId,
       scheduled_date AS scheduledDate,
       status,
       was_shifted AS wasShifted,
       shift_reason AS shiftReason,
       '' AS workoutName
     FROM workout_instances
     WHERE id = ?`,
    instanceId,
  );
  if (!row) throw new Error('Workout instance not found');

  const resolved = resolveMissedWorkout(
    {
      id: row.instanceId,
      scheduledDate: row.scheduledDate,
      status: row.status,
      wasShifted: row.wasShifted === 1,
      shiftReason: row.shiftReason,
    },
    resolution,
  );
  await db.runAsync(
    `UPDATE workout_instances
     SET scheduled_date = ?,
         status = ?,
         was_shifted = ?,
         shift_reason = ?,
         updated_at = ?
     WHERE id = ?`,
    resolved.scheduledDate,
    resolved.status,
    resolved.wasShifted ? 1 : 0,
    resolved.shiftReason,
    new Date().toISOString(),
    instanceId,
  );

  return resolved;
}

function toIsoDate(date: Date | string) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}
