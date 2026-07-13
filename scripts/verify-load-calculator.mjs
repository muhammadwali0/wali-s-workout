import assert from 'node:assert/strict';

const {
  calculateBracket,
  calculatePercentLoad,
  estimateOneRepMax,
  roundToIncrement,
} = await import('../src/domain/load/loadCalculator.ts');

assert.equal(calculatePercentLoad(200, 75), 150);
assert.equal(roundToIncrement(152.4, 2.5), 152.5);
assert.equal(roundToIncrement(151.1, 2.5), 150);

assert.deepEqual(calculateBracket(180, 80, 85, 2.5), {
  low: 144,
  high: 153,
  roundedLow: 145,
  roundedHigh: 152.5,
});

assert.equal(estimateOneRepMax(100, 1), 100);
assert.equal(Math.round(estimateOneRepMax(100, 8) * 10) / 10, 126.7);
assert.throws(() => calculateBracket(100, 90, 80, 2.5), /lowPercent/);
assert.throws(() => estimateOneRepMax(100, 0), /reps/);

console.log('load calculator verified');
