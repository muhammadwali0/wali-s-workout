import assert from 'node:assert/strict';

const {
  getActiveExerciseReplacements,
  restoreExerciseReplacement,
  saveExerciseReplacement,
} = await import('../src/db/modificationQueries.ts');

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

const replacements = await getActiveExerciseReplacements({
  async getAllAsync(sql) {
    assert.match(sql, /FROM program_modifications/);
    assert.match(sql, /json_extract/);
    return [
      {
        id: 'replace_back_squat_front_squat_today_only',
        scope: 'today_only',
        targetEntityId: 'back_squat',
        payloadJson: JSON.stringify({ replacementExerciseId: 'front_squat' }),
        reason: null,
        originalName: 'Back Squat',
        replacementName: 'Front Squat',
      },
    ];
  },
});

assert.deepEqual(replacements, [
  {
    id: 'replace_back_squat_front_squat_today_only',
    originalExerciseId: 'back_squat',
    originalName: 'Back Squat',
    replacementExerciseId: 'front_squat',
    replacementName: 'Front Squat',
    scope: 'today_only',
    reason: null,
  },
]);

const restoreCalls = [];
await restoreExerciseReplacement(
  {
    async runAsync(sql, ...params) {
      restoreCalls.push({ sql, params });
    },
  },
  'replace_back_squat_front_squat_today_only',
  '2026-01-02T00:00:00Z',
);
assert.match(restoreCalls[0].sql, /UPDATE program_modifications/);
assert.match(restoreCalls[0].sql, /is_active = 0/);
assert.deepEqual(restoreCalls[0].params, [
  '2026-01-02T00:00:00Z',
  'replace_back_squat_front_squat_today_only',
]);
