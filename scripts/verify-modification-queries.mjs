import assert from 'node:assert/strict';

const { saveExerciseReplacement } = await import(
  '../src/db/modificationQueries.ts'
);

const calls = [];
const db = {
  async getFirstAsync(sql, ...params) {
    calls.push({ sql, params });
    return { id: 'alt_1' };
  },
  async runAsync(sql, ...params) {
    calls.push({ sql, params });
  },
};

const id = await saveExerciseReplacement(db, {
  originalExerciseId: 'back_squat',
  replacementExerciseId: 'front_squat',
  scope: 'today_only',
  recordedAt: '2026-01-01T00:00:00Z',
});

assert.equal(id, 'replace_back_squat_front_squat_today_only');
assert.match(calls[0].sql, /FROM exercise_alternatives/);
assert.match(calls[0].sql, /same_primary_muscles = 1/);
assert.match(calls[0].sql, /same_movement_pattern = 1/);
assert.deepEqual(calls[0].params, ['back_squat', 'front_squat']);
assert.match(calls[1].sql, /INSERT OR REPLACE INTO program_modifications/);
assert.deepEqual(calls[1].params.slice(0, 6), [
  'replace_back_squat_front_squat_today_only',
  'replace_exercise',
  'today_only',
  'exercise',
  'back_squat',
  JSON.stringify({
    originalExerciseId: 'back_squat',
    replacementExerciseId: 'front_squat',
  }),
]);

const badDb = {
  async getFirstAsync() {
    return null;
  },
  async runAsync() {
    throw new Error('should not insert');
  },
};
await assert.rejects(
  () =>
    saveExerciseReplacement(badDb, {
      originalExerciseId: 'back_squat',
      replacementExerciseId: 'barbell_bench_press',
      scope: 'today_only',
    }),
  /faithful/,
);

console.log('modification queries verified');
