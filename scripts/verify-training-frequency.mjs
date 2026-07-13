import assert from 'node:assert/strict';

const { getTrainingFrequency } = await import(
  '../src/domain/analytics/trainingFrequency.ts'
);

assert.deepEqual(
  getTrainingFrequency([
    { scheduledDate: '2026-01-01', status: 'completed' },
    { scheduledDate: '2026-01-02', status: 'missed' },
    { scheduledDate: '2026-01-09', status: 'completed' },
  ]),
  [
    { weekKey: '2026-W01', completed: 1, scheduled: 2 },
    { weekKey: '2026-W02', completed: 1, scheduled: 1 },
  ],
);

console.log('training frequency verified');
