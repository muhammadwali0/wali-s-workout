export type WorkoutInstanceStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'missed'
  | 'rescheduled';

export type WorkoutInstance = {
  id: string;
  scheduledDate: string;
  status: WorkoutInstanceStatus;
  wasShifted: boolean;
  shiftReason: string | null;
};

export type MissedWorkoutResolution =
  | { action: 'do_today_and_shift'; today: string }
  | { action: 'move_to_date'; date: string; reason?: string }
  | { action: 'skip'; reason?: string }
  | { action: 'keep_unresolved' };

export function resolveMissedWorkout(
  workout: WorkoutInstance,
  resolution: MissedWorkoutResolution,
): WorkoutInstance {
  if (workout.status !== 'missed') {
    throw new Error('Only missed workouts can be resolved');
  }

  if (resolution.action === 'keep_unresolved') {
    return workout;
  }

  if (resolution.action === 'skip') {
    return {
      ...workout,
      status: 'skipped',
      shiftReason: resolution.reason ?? null,
    };
  }

  if (resolution.action === 'do_today_and_shift') {
    return {
      ...workout,
      scheduledDate: resolution.today,
      status: 'rescheduled',
      wasShifted: true,
      shiftReason: 'Do missed workout today and shift schedule',
    };
  }

  return {
    ...workout,
    scheduledDate: resolution.date,
    status: 'rescheduled',
    wasShifted: true,
    shiftReason: resolution.reason ?? null,
  };
}
