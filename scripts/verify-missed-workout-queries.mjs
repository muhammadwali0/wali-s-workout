import assert from 'node:assert/strict';

const {
  getMissedWorkoutInstances,
  markOverdueWorkoutsMissed,
  resolveMissedWorkoutInstance,
} = await import('../src/db/missedWorkoutQueries.ts');

const calls = [];
const db = {
  async runAsync(sql, ...params) {
    calls.push({ type: 'run', sql, params });
  },
  async getAllAsync(sql) {
    calls.push({ type: 'all', sql });
    return [
      {
        instanceId: 'instance_1',
        programWorkoutId: 'workout_1',
        scheduledDate: '2026-01-01',
        status: 'missed',
        wasShifted: 0,
        shiftReason: null,
        workoutName: 'Day 1',
      },
    ];
  },
  async getFirstAsync(sql, instanceId) {
    calls.push({ type: 'first', sql, instanceId });
    return {
      instanceId,
      programWorkoutId: 'workout_1',
      scheduledDate: '2026-01-01',
      status: 'missed',
      wasShifted: 0,
      shiftReason: null,
      workoutName: '',
    };
  },
};

await markOverdueWorkoutsMissed(db, '2026-01-03');
assert.match(calls[0].sql, /status = 'missed'/);
assert.match(calls[0].sql, /scheduled_date < \?/);
assert.equal(calls[0].params[1], '2026-01-03');

assert.equal((await getMissedWorkoutInstances(db))[0].instanceId, 'instance_1');
assert.match(calls[1].sql, /WHERE wi\.status = 'missed'/);

const skipped = await resolveMissedWorkoutInstance(db, 'instance_1', {
  action: 'skip',
  reason: 'travel',
});
assert.equal(skipped.status, 'skipped');
assert.equal(calls[3].params[1], 'skipped');
assert.equal(calls[3].params[3], 'travel');

const moved = await resolveMissedWorkoutInstance(db, 'instance_1', {
  action: 'do_today_and_shift',
  today: '2026-01-04',
});
assert.equal(moved.status, 'rescheduled');
assert.equal(moved.scheduledDate, '2026-01-04');
assert.equal(calls[5].params[0], '2026-01-04');
assert.equal(calls[5].params[2], 1);

console.log('missed workout queries verified');
