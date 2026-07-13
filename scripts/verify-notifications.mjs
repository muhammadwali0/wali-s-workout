import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const {
  planMissedWorkoutNotification,
  planUnfinishedSessionNotification,
  planWeekStatusNotification,
  planWorkoutDueNotification,
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
  },
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

assert.deepEqual(planMissedWorkoutNotification('2026-01-01', 'Upper 1', settings), {
  type: 'missed_workout',
  scheduledFor: '2026-01-01T21:00:00',
  title: 'Scheduled workout unresolved',
  body: 'Upper 1 remains pending. Choose whether to shift, move, or skip it.',
});
assert.deepEqual(
  planUnfinishedSessionNotification('2026-01-01T12:00:00', 'Full Body 1', settings),
  {
    type: 'unfinished_session',
    scheduledFor: '2026-01-01T12:00:00',
    title: 'Workout session unfinished',
    body: 'Full Body 1 has saved set data and is still in progress.',
  },
);

console.log('notifications verified');
