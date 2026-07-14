import type { DueWorkout } from '../program/seedResolver';
import type { ProgramPosition } from '../program/yearEngine';

export type NotificationSettings = {
  workoutRemindersEnabled: boolean;
  workoutReminderTime: string | null;
  missedWorkoutEnabled: boolean;
  missedWorkoutTime: string | null;
  unfinishedSessionEnabled: boolean;
  deloadRemindersEnabled: boolean;
  testWeekRemindersEnabled: boolean;
};

export type PlannedNotification = {
  type:
    | 'workout_due'
    | 'missed_workout'
    | 'unfinished_session'
    | 'deload_week'
    | 'taper_week'
    | 'test_week'
    | 'phase_transition'
    | 'rest_timer';
  scheduledFor: string;
  title: string;
  body: string;
  route: 'today' | 'year' | 'library';
};

export function isValidNotificationTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function planWorkoutDueNotification(
  date: string,
  position: ProgramPosition,
  dueWorkout: DueWorkout,
  settings: NotificationSettings,
): PlannedNotification | null {
  if (
    !settings.workoutRemindersEnabled ||
    !settings.workoutReminderTime ||
    !isValidNotificationTime(settings.workoutReminderTime) ||
    position.status !== 'in_year' ||
    dueWorkout.status !== 'workout_due'
  ) {
    return null;
  }

  return {
    type: 'workout_due',
    scheduledFor: `${date}T${settings.workoutReminderTime}:00`,
    title: 'Training session due',
    body: `Block ${position.week.blockNumber} - Week ${position.week.yearWeekNumber} - ${dueWorkout.workout.name}`,
    route: 'today',
  };
}

export function planWeekStatusNotification(
  date: string,
  position: ProgramPosition,
  settings: NotificationSettings,
): PlannedNotification | null {
  if (position.status !== 'in_year') return null;

  if (position.week.weekType === 'deload' && settings.deloadRemindersEnabled) {
    return {
      type: 'deload_week',
      scheduledFor: `${date}T08:00:00`,
      title: 'Deload week begins',
      body: `Block ${position.week.blockNumber} - Week ${position.week.yearWeekNumber}. Follow the prescribed lower work closely.`,
      route: 'today',
    };
  }

  if (position.week.weekType === 'taper' && settings.deloadRemindersEnabled) {
    return {
      type: 'taper_week',
      scheduledFor: `${date}T08:00:00`,
      title: 'Taper week begins',
      body: `Block ${position.week.blockNumber} - Week ${position.week.yearWeekNumber}. Prioritize accurate execution.`,
      route: 'today',
    };
  }

  if (position.week.weekType === 'test' && settings.testWeekRemindersEnabled) {
    return {
      type: 'test_week',
      scheduledFor: `${date}T08:00:00`,
      title: 'Testing week begins',
      body: `Block ${position.week.blockNumber} - Week ${position.week.yearWeekNumber}. Review current baselines before testing.`,
      route: 'library',
    };
  }

  if (position.week.isBuffer && settings.testWeekRemindersEnabled) {
    return {
      type: 'phase_transition',
      scheduledFor: `${date}T08:00:00`,
      title: 'Phase transition ready',
      body: `Block ${position.week.blockNumber} buffer week. Review and confirm 1RM baselines before the next block.`,
      route: 'library',
    };
  }

  return null;
}

export function planNextWeekStatusNotification(
  referenceDate: Date | string,
  position: ProgramPosition,
  settings: NotificationSettings,
): PlannedNotification | null {
  const reference =
    typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  if (!Number.isFinite(reference.getTime())) return null;

  return planWeekStatusNotification(
    getNextLocalDateForTime(reference, '08:00'),
    position,
    settings,
  );
}

export function planMissedWorkoutNotification(
  date: string,
  workoutName: string,
  settings: NotificationSettings,
): PlannedNotification | null {
  if (
    !settings.missedWorkoutEnabled ||
    !settings.missedWorkoutTime ||
    !isValidNotificationTime(settings.missedWorkoutTime)
  ) {
    return null;
  }

  return {
    type: 'missed_workout',
    scheduledFor: `${date}T${settings.missedWorkoutTime}:00`,
    title: 'Scheduled workout unresolved',
    body: `${workoutName} remains pending. Choose whether to shift, move, or skip it.`,
    route: 'year',
  };
}

export function planNextMissedWorkoutNotification(
  referenceDate: Date | string,
  workoutName: string,
  settings: NotificationSettings,
): PlannedNotification | null {
  if (!settings.missedWorkoutTime || !isValidNotificationTime(settings.missedWorkoutTime)) {
    return null;
  }

  const reference =
    typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  if (!Number.isFinite(reference.getTime())) return null;

  return planMissedWorkoutNotification(
    getNextLocalDateForTime(reference, settings.missedWorkoutTime),
    workoutName,
    settings,
  );
}

export function planUnfinishedSessionNotification(
  scheduledFor: string,
  workoutName: string,
  settings: NotificationSettings,
): PlannedNotification | null {
  if (!settings.unfinishedSessionEnabled) return null;

  return {
    type: 'unfinished_session',
    scheduledFor,
    title: 'Workout session unfinished',
    body: `${workoutName} has saved set data and is still in progress.`,
    route: 'today',
  };
}

export function planRestTimerNotification(
  scheduledFor: string,
  exerciseName: string,
): PlannedNotification {
  return {
    type: 'rest_timer',
    scheduledFor,
    title: 'Rest complete',
    body: `${exerciseName}: begin the next set when ready.`,
    route: 'today',
  };
}

function getNextLocalDateForTime(reference: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(reference);
  scheduled.setHours(hours, minutes, 0, 0);
  if (scheduled.getTime() <= reference.getTime()) {
    scheduled.setDate(scheduled.getDate() + 1);
  }
  return [
    scheduled.getFullYear(),
    String(scheduled.getMonth() + 1).padStart(2, '0'),
    String(scheduled.getDate()).padStart(2, '0'),
  ].join('-');
}
