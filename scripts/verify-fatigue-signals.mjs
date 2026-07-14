import assert from 'node:assert/strict';

const { calculateFatigueSignals } = await import(
  '../src/domain/analytics/fatigueSignals.ts'
);

const signals = calculateFatigueSignals(
  [
    {
      completedAt: '2026-01-01T10:00:00Z',
      completed: true,
      setType: 'working',
      weight: 100,
      reps: 5,
      rpe: 9,
      rir: 1,
      failed: 0,
    },
    {
      completedAt: '2026-01-02T10:00:00Z',
      completed: true,
      setType: 'warmup',
      weight: 60,
      reps: 5,
      rpe: 5,
      rir: 5,
      failed: 0,
    },
    {
      completedAt: '2026-01-08T10:00:00Z',
      completed: true,
      setType: 'working',
      weight: 80,
      reps: 5,
      rpe: 10,
      rir: 0,
      failed: 1,
    },
  ],
  [
    { scheduledDate: '2026-01-08', status: 'missed' },
    { scheduledDate: '2026-01-09', status: 'completed' },
  ],
);

assert.equal(signals.workingSets, 2);
assert.equal(signals.failedSets, 1);
assert.equal(signals.highRpeSets, 2);
assert.equal(signals.lowRirSets, 2);
assert.equal(signals.missedSessions, 1);
assert.equal(signals.performanceDropSignals, 1);
assert.equal(signals.priorWeekVolume, 500);
assert.equal(signals.latestWeekVolume, 400);
assert.equal(signals.riskLevel, 'high');

console.log('fatigue signals verified');
