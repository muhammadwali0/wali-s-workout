import assert from 'node:assert/strict';

const { progressRepRange } = await import('../src/domain/workout/progression.ts');

assert.deepEqual(
  progressRepRange({
    currentLoad: 20,
    reps: [10, 9, 8],
    targetRepsMin: 8,
    targetRepsMax: 12,
    loadIncrement: 2.5,
  }),
  { nextLoad: 20, nextTargetReps: 11, progressedLoad: false },
);

assert.deepEqual(
  progressRepRange({
    currentLoad: 20,
    reps: [12, 12, 12],
    targetRepsMin: 8,
    targetRepsMax: 12,
    loadIncrement: 2.5,
  }),
  { nextLoad: 22.5, nextTargetReps: 8, progressedLoad: true },
);

assert.throws(
  () =>
    progressRepRange({
      currentLoad: 20,
      reps: [],
      targetRepsMin: 8,
      targetRepsMax: 12,
      loadIncrement: 2.5,
    }),
  /reps/,
);

console.log('progression verified');
