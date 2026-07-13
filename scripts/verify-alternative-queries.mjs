import assert from 'node:assert/strict';

const { getExerciseAlternatives } = await import(
  '../src/db/alternativeQueries.ts'
);

const rows = [
  {
    sourceExerciseId: 'back_squat',
    sourceName: 'Back Squat',
    alternativeExerciseId: 'front_squat',
    alternativeName: 'Front Squat',
    compatibilityScore: 92,
    reason: 'similar squat pattern',
  },
];
const calls = [];
const db = {
  async getAllAsync(sql) {
    calls.push(sql);
    return rows;
  },
};

assert.deepEqual(await getExerciseAlternatives(db), rows);
assert.match(calls[0], /FROM exercise_alternatives/);
assert.match(calls[0], /JOIN exercises source/);
assert.match(calls[0], /JOIN exercises alternative/);
assert.match(calls[0], /same_primary_muscles = 1/);
assert.match(calls[0], /same_movement_pattern = 1/);
assert.match(calls[0], /compatibility_score DESC/);

console.log('alternative queries verified');
