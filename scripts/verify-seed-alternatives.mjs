import assert from 'node:assert/strict';

const { getExerciseProfile, getFaithfulAlternatives } = await import(
  '../src/domain/exercises/seedAlternatives.ts'
);

const bench = getExerciseProfile('barbell_bench_press');
assert.deepEqual(bench.primaryMuscles, ['chest', 'triceps']);
assert.equal(bench.movementPattern, 'horizontal_push');

const alternatives = getFaithfulAlternatives('barbell_bench_press');
assert.equal(alternatives.length > 0, true);
assert.equal(alternatives[0].compatibilityScore, 100);
assert.equal(alternatives[0].reasons.includes('Movement pattern match'), true);
assert.equal(
  alternatives.every((alternative) => alternative.exerciseId !== 'lying_leg_curl'),
  true,
);

assert.deepEqual(getFaithfulAlternatives('missing_exercise'), []);

console.log('seed alternatives verified');
