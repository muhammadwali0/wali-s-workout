import assert from 'node:assert/strict';

const { getWeeklyVolume } = await import('../src/domain/analytics/weeklyVolume.ts');

assert.deepEqual(
  getWeeklyVolume([
    {
      completedAt: '2026-01-01T10:00:00Z',
      setType: 'working',
      completed: true,
      weight: 100,
      reps: 5,
    },
    {
      completedAt: '2026-01-02T10:00:00Z',
      setType: 'warmup',
      completed: true,
      weight: 60,
      reps: 5,
    },
    {
      completedAt: '2026-01-08T10:00:00Z',
      setType: 'working',
      completed: true,
      weight: 110,
      reps: 5,
    },
    {
      completedAt: '2026-01-08T10:00:00Z',
      setType: 'working',
      completed: false,
      weight: 120,
      reps: 5,
    },
  ]),
  [
    { weekKey: '2026-W01', totalVolume: 500, totalSets: 1 },
    { weekKey: '2026-W02', totalVolume: 550, totalSets: 1 },
  ],
);

console.log('weekly volume verified');
