import assert from 'node:assert/strict';

const { getRecentPersonalRecords } = await import(
  '../src/db/personalRecordQueries.ts'
);

const rows = [
  {
    recordId: 'pr_1',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    prType: 'max_weight',
    weight: 150,
    reps: 1,
    estimatedOneRm: null,
    volume: null,
    unit: 'kg',
    achievedAt: '2026-01-01T10:00:00Z',
  },
];
const calls = [];
const db = {
  async getAllAsync(sql, limit) {
    calls.push({ sql, limit });
    return rows;
  },
};

assert.deepEqual(await getRecentPersonalRecords(db, 5), rows);
assert.equal(calls[0].limit, 5);
assert.match(calls[0].sql, /FROM personal_records/);
assert.match(calls[0].sql, /JOIN exercises/);
assert.match(calls[0].sql, /ORDER BY pr\.achieved_at DESC/);
assert.match(calls[0].sql, /LIMIT \?/);

console.log('personal record queries verified');
