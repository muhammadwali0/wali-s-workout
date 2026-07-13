import assert from 'node:assert/strict';

const { getExerciseLibrary } = await import('../src/db/libraryQueries.ts');

const rows = [
  {
    exerciseId: 'back_squat',
    name: 'Back Squat',
    category: 'barbell',
    movementPattern: 'squat',
    equipment: 'barbell',
    defaultRole: 'primary',
    primaryMuscles: 'Quads,Glutes',
    alternativeCount: 2,
  },
];
const calls = [];
const db = {
  async getAllAsync(sql, limit) {
    calls.push({ sql, limit });
    return rows;
  },
};

assert.deepEqual(await getExerciseLibrary(db, 7), rows);
assert.equal(calls[0].limit, 7);
assert.match(calls[0].sql, /FROM exercises/);
assert.match(calls[0].sql, /LEFT JOIN exercise_muscles/);
assert.match(calls[0].sql, /LEFT JOIN exercise_alternatives/);
assert.match(calls[0].sql, /GROUP_CONCAT\(DISTINCT m\.name\)/);
assert.match(calls[0].sql, /LIMIT \?/);

console.log('library queries verified');
