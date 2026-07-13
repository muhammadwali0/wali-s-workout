import assert from 'node:assert/strict';

const { getCompletedAnalyticsSets } = await import('../src/db/analyticsQueries.ts');

const rows = [
  {
    completedAt: '2026-01-01T10:00:00Z',
    exerciseId: 'back_squat',
    setType: 'working',
    completed: 1,
    weight: 100,
    reps: 5,
  },
];
const calls = [];
const db = {
  async getAllAsync(sql) {
    calls.push(sql);
    return rows;
  },
};

assert.deepEqual(await getCompletedAnalyticsSets(db), rows);
assert.match(calls[0], /JOIN exercise_logs/);
assert.match(calls[0], /JOIN workout_logs/);
assert.match(calls[0], /sl\.is_completed = 1/);
assert.match(calls[0], /wl\.status = 'completed'/);
assert.match(calls[0], /wl\.completed_at IS NOT NULL/);

console.log('analytics queries verified');
