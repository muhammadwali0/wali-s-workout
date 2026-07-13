import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { applyExerciseReplacements, createPlannedSets } = await import(
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
  exerciseRole: 'primary',
  originalExerciseId: 'back_squat',
  originalExerciseName: 'Back Squat',
  substitutionScope: null,
  exerciseOrder: 1,
  supersetGroup: null,
  setNumber: 1,
  setType: 'warmup',
  targetReps: null,
  percent1RmLow: null,
  percent1RmHigh: null,
  targetRpeLow: null,
  targetRpeHigh: null,
  restSecondsMin: null,
  restSecondsMax: null,
  tempo: null,
  notes: null,
});
assert.equal(sets.filter((set) => set.exerciseId === 'back_squat').length, 7);
assert.equal(sets.find((set) => set.setType === 'working').targetReps, '5');

const supersetDue = getDueWorkout(getProgramPosition('2026-01-09', year));
assert.equal(supersetDue.status, 'workout_due');
assert.equal(
  createPlannedSets(supersetDue.workout).some((set) => set.supersetGroup !== null),
  true,
);

const personalized = applyExerciseReplacements(sets, [
  {
    originalExerciseId: 'back_squat',
    replacementExerciseId: 'front_squat',
    replacementName: 'Front Squat',
    scope: 'today_only',
  },
]);
assert.equal(personalized[0].exerciseId, 'front_squat');
assert.equal(personalized[0].exerciseName, 'Front Squat');
assert.equal(personalized[0].originalExerciseId, 'back_squat');
assert.equal(personalized[0].originalExerciseName, 'Back Squat');
assert.equal(personalized[0].substitutionScope, 'today_only');
assert.equal(sets[0].exerciseId, 'back_squat');

console.log('session planner verified');
