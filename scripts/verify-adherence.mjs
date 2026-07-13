import assert from 'node:assert/strict';

const { calculateAdherence } = await import(
  '../src/domain/analytics/adherence.ts'
);

assert.deepEqual(calculateAdherence([]), {
  dueSessions: 0,
  completed: 0,
  missed: 0,
  skipped: 0,
  rescheduled: 0,
  inProgress: 0,
  completionRate: 0,
});

const stats = calculateAdherence([
  { status: 'completed' },
  { status: 'completed' },
  { status: 'missed' },
  { status: 'skipped' },
  { status: 'rescheduled' },
  { status: 'in_progress' },
  { status: 'scheduled' },
]);

assert.equal(stats.dueSessions, 6);
assert.equal(stats.completed, 2);
assert.equal(stats.missed, 1);
assert.equal(stats.skipped, 1);
assert.equal(stats.rescheduled, 1);
assert.equal(stats.inProgress, 1);
assert.equal(Math.round(stats.completionRate * 1000) / 1000, 0.333);

console.log('adherence analytics verified');
