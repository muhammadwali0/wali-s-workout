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
    | 'test_week';
  scheduledFor: string;
  title: string;
  body: string;
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
    };
  }

  if (position.week.weekType === 'taper' && settings.deloadRemindersEnabled) {
    return {
      type: 'taper_week',
      scheduledFor: `${date}T08:00:00`,
      title: 'Taper week begins',
      body: `Block ${position.week.blockNumber} - Week ${position.week.yearWeekNumber}. Prioritize accurate execution.`,
    };
  }

  if (position.week.weekType === 'test' && settings.testWeekRemindersEnabled) {
    return {
      type: 'test_week',
      scheduledFor: `${date}T08:00:00`,
      title: 'Testing week begins',
      body: `Block ${position.week.blockNumber} - Week ${position.week.yearWeekNumber}. Review current baselines before testing.`,
    };
  }

  return null;
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
  };
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
  };
}
