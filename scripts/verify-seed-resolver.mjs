import assert from 'node:assert/strict';

const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);

const year = createTrainingYear('2026-01-01');

const firstDay = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(firstDay.status, 'workout_due');
assert.equal(firstDay.workout.id, 'phase1_w01_d1');
assert.deepEqual(firstDay.mainLifts.slice(0, 2), ['Back Squat', 'Back Squat']);

const restDay = getDueWorkout(getProgramPosition('2026-01-03', year));
assert.equal(restDay.status, 'rest_day');
assert.equal(restDay.nextWorkout.id, 'phase1_w01_d3');

const bufferWeek = getDueWorkout(getProgramPosition('2026-03-19', year));
assert.equal(bufferWeek.status, 'buffer_week');

console.log('seed resolver verified');
