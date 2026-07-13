import assert from 'node:assert/strict';

const { detectPersonalRecords } = await import(
  '../src/domain/analytics/personalRecords.ts'
);

const prior = {
  maxWeight: 100,
  maxRepsAtWeight: { 100: 3, 90: 8 },
  estimatedOneRepMax: 120,
  maxVolume: 720,
};

assert.deepEqual(detectPersonalRecords({ weight: 90, reps: 8 }, prior), []);

assert.deepEqual(detectPersonalRecords({ weight: 102.5, reps: 4 }, prior), [
  { type: 'max_weight', value: 102.5 },
  { type: 'rep_pr', weight: 102.5, reps: 4 },
]);

assert.deepEqual(detectPersonalRecords({ weight: 100, reps: 5 }, prior), [
  { type: 'rep_pr', weight: 100, reps: 5 },
]);

assert.deepEqual(
  detectPersonalRecords(
    { weight: 100, reps: 8 },
    { ...prior, estimatedOneRepMax: 125 },
  ),
  [
    { type: 'rep_pr', weight: 100, reps: 8 },
    { type: 'estimated_1rm', value: 126.66666666666666 },
    { type: 'volume_pr', value: 800 },
  ],
);

assert.throws(() => detectPersonalRecords({ weight: -1, reps: 1 }, prior), /weight/);
assert.throws(() => detectPersonalRecords({ weight: 1, reps: 0 }, prior), /reps/);

console.log('personal records verified');
