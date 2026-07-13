import assert from 'node:assert/strict';

const { rankAlternatives, scoreAlternative } = await import(
  '../src/domain/exercises/alternativeRanker.ts'
);

const bench = {
  id: 'barbell_bench_press',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['front_delts', 'triceps'],
  movementPattern: 'horizontal_push',
  role: 'primary',
  equipment: 'barbell',
};

const dumbbellPress = {
  id: 'dumbbell_bench_press',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['front_delts', 'triceps'],
  movementPattern: 'horizontal_push',
  role: 'primary',
  equipment: 'dumbbell',
};

const randomLegCurl = {
  id: 'lying_leg_curl',
  primaryMuscles: ['hamstrings'],
  movementPattern: 'knee_flexion',
  role: 'tertiary',
  equipment: 'machine',
};

const score = scoreAlternative(bench, dumbbellPress);
assert.equal(score.isFaithful, true);
assert.equal(score.score, 80);
assert.deepEqual(score.reasons, [
  'Primary muscle match',
  'Movement pattern match',
  'Session role match',
  'Secondary muscle overlap',
]);

const poorScore = scoreAlternative(bench, randomLegCurl);
assert.equal(poorScore.isFaithful, false);
assert.equal(poorScore.score, 0);

assert.deepEqual(
  rankAlternatives(bench, [randomLegCurl, dumbbellPress]).map(
    (result) => result.candidateId,
  ),
  ['dumbbell_bench_press', 'lying_leg_curl'],
);

console.log('alternative scoring verified');
