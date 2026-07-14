import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const {
  planMissedWorkoutNotification,
  planNextMissedWorkoutNotification,
  planNextWeekStatusNotification,
  planRestTimerNotification,
  planUnfinishedSessionNotification,
  planWeekStatusNotification,
  planWorkoutDueNotification,
  isValidNotificationTime,
} = await import('../src/domain/notifications/notificationPlanner.ts');

const settings = {
  workoutRemindersEnabled: true,
  workoutReminderTime: '07:30',
  missedWorkoutEnabled: true,
  missedWorkoutTime: '21:00',
  unfinishedSessionEnabled: true,
  deloadRemindersEnabled: true,
  testWeekRemindersEnabled: true,
};
const year = createTrainingYear('2026-01-01');
const firstPosition = getProgramPosition('2026-01-01', year);
const firstDue = getDueWorkout(firstPosition);

assert.deepEqual(
  planWorkoutDueNotification('2026-01-01', firstPosition, firstDue, settings),
  {
    type: 'workout_due',
    scheduledFor: '2026-01-01T07:30:00',
    title: 'Training session due',
    body: 'Block 1 - Week 1 - Day 1: Back Squat / Back Squat',
    route: 'today',
  },
);
assert.equal(isValidNotificationTime('23:59'), true);
assert.equal(isValidNotificationTime('24:00'), false);
assert.equal(
  planWorkoutDueNotification('2026-01-01', firstPosition, firstDue, {
    ...settings,
    workoutReminderTime: '24:00',
  }),
  null,
);
assert.equal(
  planWorkoutDueNotification('2026-01-03', getProgramPosition('2026-01-03', year), getDueWorkout(getProgramPosition('2026-01-03', year)), settings),
  null,
);

assert.equal(
  planWeekStatusNotification('2026-01-01', firstPosition, settings),
  null,
);
assert.equal(
  planWeekStatusNotification('2026-03-12', getProgramPosition('2026-03-12', year), settings)?.type,
  'deload_week',
);
assert.equal(
  planWeekStatusNotification('2026-08-27', getProgramPosition('2026-08-27', year), settings)?.type,
  'taper_week',
);
assert.equal(
  planWeekStatusNotification('2026-03-05', getProgramPosition('2026-03-05', year), settings)?.type,
  'test_week',
);
assert.deepEqual(
  planWeekStatusNotification('2026-03-19', getProgramPosition('2026-03-19', year), settings),
  {
    type: 'phase_transition',
    scheduledFor: '2026-03-19T08:00:00',
    title: 'Phase transition ready',
    body: 'Block 1 buffer week. Review and confirm 1RM baselines before the next block.',
    route: 'library',
  },
);
assert.equal(
  planNextWeekStatusNotification(
    new Date(2026, 2, 19, 9, 0),
    getProgramPosition('2026-03-19', year),
    settings,
  )?.scheduledFor,
  '2026-03-20T08:00:00',
);

assert.deepEqual(planMissedWorkoutNotification('2026-01-01', 'Upper 1', settings), {
  type: 'missed_workout',
  scheduledFor: '2026-01-01T21:00:00',
  title: 'Scheduled workout unresolved',
  body: 'Upper 1 remains pending. Choose whether to shift, move, or skip it.',
  route: 'year',
});
assert.equal(
  planMissedWorkoutNotification('2026-01-01', 'Upper 1', {
    ...settings,
    missedWorkoutTime: '9pm',
  }),
  null,
);
assert.equal(
  planNextMissedWorkoutNotification(new Date(2026, 0, 1, 20, 0), 'Upper 1', settings)
    ?.scheduledFor,
  '2026-01-01T21:00:00',
);
assert.equal(
  planNextMissedWorkoutNotification(new Date(2026, 0, 1, 22, 0), 'Upper 1', settings)
    ?.scheduledFor,
  '2026-01-02T21:00:00',
);
assert.deepEqual(
  planUnfinishedSessionNotification('2026-01-01T12:00:00', 'Full Body 1', settings),
  {
    type: 'unfinished_session',
    scheduledFor: '2026-01-01T12:00:00',
    title: 'Workout session unfinished',
    body: 'Full Body 1 has saved set data and is still in progress.',
    route: 'today',
  },
);
assert.deepEqual(planRestTimerNotification('2026-01-01T10:04:00', 'Back Squat'), {
  type: 'rest_timer',
  scheduledFor: '2026-01-01T10:04:00',
  title: 'Rest complete',
  body: 'Back Squat: begin the next set when ready.',
  route: 'today',
});

console.log('notifications verified');
