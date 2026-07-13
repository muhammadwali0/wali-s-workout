import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);

const year = createTrainingYear('2026-01-01');
const due = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(due.status, 'workout_due');

const sets = createPlannedSets(due.workout);
assert.equal(sets.length, 23);
assert.deepEqual(sets[0], {
  id: 'phase1_w01_d1_e01_s01_1',
  exerciseId: 'back_squat',
  exerciseName: 'Back Squat',
  exerciseOrder: 1,
  setNumber: 1,
  setType: 'warmup',
  targetReps: null,
  percent1RmLow: null,
  percent1RmHigh: null,
  targetRpeLow: null,
  targetRpeHigh: null,
  restSecondsMin: null,
  restSecondsMax: null,
});
assert.equal(sets.filter((set) => set.exerciseId === 'back_squat').length, 7);
assert.equal(sets.find((set) => set.setType === 'working').targetReps, '5');

console.log('session planner verified');
