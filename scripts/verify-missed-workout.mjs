import assert from 'node:assert/strict';

const { resolveMissedWorkout } = await import(
  '../src/domain/program/missedWorkout.ts'
);

const missed = {
  id: 'instance_1',
  scheduledDate: '2026-01-01',
  status: 'missed',
  wasShifted: false,
  shiftReason: null,
};

assert.deepEqual(
  resolveMissedWorkout(missed, { action: 'keep_unresolved' }),
  missed,
);
assert.deepEqual(resolveMissedWorkout(missed, { action: 'skip', reason: 'travel' }), {
  ...missed,
  status: 'skipped',
  shiftReason: 'travel',
});
assert.deepEqual(
  resolveMissedWorkout(missed, {
    action: 'move_to_date',
    date: '2026-01-04',
    reason: 'manual move',
  }),
  {
    ...missed,
    scheduledDate: '2026-01-04',
    status: 'rescheduled',
    wasShifted: true,
    shiftReason: 'manual move',
  },
);
assert.deepEqual(
  resolveMissedWorkout(missed, {
    action: 'do_today_and_shift',
    today: '2026-01-02',
  }),
  {
    ...missed,
    scheduledDate: '2026-01-02',
    status: 'rescheduled',
    wasShifted: true,
    shiftReason: 'Do missed workout today and shift schedule',
  },
);
assert.throws(
  () => resolveMissedWorkout({ ...missed, status: 'scheduled' }, { action: 'skip' }),
  /missed/,
);

console.log('missed workout resolution verified');
