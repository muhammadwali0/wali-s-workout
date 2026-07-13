import assert from 'node:assert/strict';

const { getWeeklyAverageRpe } = await import('../src/domain/analytics/weeklyRpe.ts');

assert.deepEqual(
  getWeeklyAverageRpe([
    { completedAt: '2026-01-01T10:00:00Z', setType: 'working', completed: true, rpe: 7 },
    { completedAt: '2026-01-02T10:00:00Z', setType: 'working', completed: true, rpe: 9 },
    { completedAt: '2026-01-03T10:00:00Z', setType: 'warmup', completed: true, rpe: 4 },
    { completedAt: '2026-01-10T10:00:00Z', setType: 'working', completed: true, rpe: null },
    { completedAt: '2026-01-10T10:00:00Z', setType: 'working', completed: true, rpe: 8 },
  ]),
  [
    { weekKey: '2026-W01', averageRpe: 8, ratedSets: 2 },
    { weekKey: '2026-W02', averageRpe: 8, ratedSets: 1 },
  ],
);

console.log('weekly RPE verified');
