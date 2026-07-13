import assert from 'node:assert/strict';

const { getTodayWorkoutInstance } = await import('../src/db/todayWorkoutQuery.ts');

const row = {
  instanceId: 'instance_1',
  programWorkoutId: 'workout_1',
  scheduledDate: '2026-01-01',
  status: 'scheduled',
  workoutName: 'Day 1',
  workoutType: 'training',
  estimatedDurationMin: 55,
};
const calls = [];
const db = {
  async getFirstAsync(sql, date) {
    calls.push({ sql, date });
    return row;
  },
};

assert.deepEqual(await getTodayWorkoutInstance(db, '2026-01-01T10:00:00Z'), row);
assert.equal(calls[0].date, '2026-01-01');
assert.match(calls[0].sql, /FROM workout_instances/);
assert.match(calls[0].sql, /JOIN program_workouts/);
assert.match(calls[0].sql, /WHERE wi\.scheduled_date = \?/);
assert.match(calls[0].sql, /LIMIT 1/);

console.log('today workout query verified');
