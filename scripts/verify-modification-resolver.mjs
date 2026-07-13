import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { resolveWorkoutExercises } = await import(
  '../src/domain/workout/modificationResolver.ts'
);

const year = createTrainingYear('2026-01-01');
const due = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(due.status, 'workout_due');

const original = resolveWorkoutExercises(due.workout, []);
assert.equal(original[0].originalExerciseId, 'back_squat');
assert.equal(original[0].currentExerciseId, 'back_squat');
assert.equal(original[0].wasSubstituted, false);

const replaced = resolveWorkoutExercises(due.workout, [
  {
    originalExerciseId: 'back_squat',
    replacementExerciseId: 'front_squat',
    scope: 'today_only',
  },
]);
assert.equal(replaced[0].originalExerciseId, 'back_squat');
assert.equal(replaced[0].currentExerciseId, 'front_squat');
assert.equal(replaced[0].originalName, 'Back Squat');
assert.equal(replaced[0].currentName, 'Front Squat');
assert.equal(replaced[0].wasSubstituted, true);
assert.equal(replaced[0].substitutionScope, 'today_only');
assert.equal(due.workout.exercises[0].exerciseId, 'back_squat');

assert.throws(
  () =>
    resolveWorkoutExercises(due.workout, [
      {
        originalExerciseId: 'back_squat',
        replacementExerciseId: 'barbell_bench_press',
        scope: 'today_only',
      },
    ]),
  /faithful/,
);

console.log('modification resolver verified');
