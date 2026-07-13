import assert from 'node:assert/strict';

const { getRecentWorkoutHistory } = await import('../src/db/historyQueries.ts');

const rows = [
  {
    workoutLogId: 'log_1',
    workoutName: 'Day 1',
    status: 'completed',
    scheduledDate: '2026-01-01',
    completedAt: '2026-01-01T10:30:00Z',
    totalVolume: 500,
    totalWorkingSets: 3,
    averageRpe: 7,
  },
];
const calls = [];
const db = {
  async getAllAsync(sql, limit) {
    calls.push({ sql, limit });
    return rows;
  },
};

assert.deepEqual(await getRecentWorkoutHistory(db, 5), rows);
assert.equal(calls[0].limit, 5);
assert.match(calls[0].sql, /FROM workout_logs/);
assert.match(calls[0].sql, /JOIN workout_instances/);
assert.match(calls[0].sql, /JOIN program_workouts/);
assert.match(calls[0].sql, /LIMIT \?/);

console.log('history queries verified');
