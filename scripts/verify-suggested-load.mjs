import assert from 'node:assert/strict';

const { getSuggestedLoad, needsOneRmRecord } = await import(
  '../src/domain/load/suggestedLoad.ts'
);

const records = [{ exerciseId: 'back_squat', value: 180 }];

assert.deepEqual(
  getSuggestedLoad(
    {
      exerciseId: 'back_squat',
      percent1RmLow: 80,
      percent1RmHigh: 85,
    },
    records,
    2.5,
  ),
  {
    low: 144,
    high: 153,
    roundedLow: 145,
    roundedHigh: 152.5,
  },
);
assert.equal(
  getSuggestedLoad(
    {
      exerciseId: 'back_squat',
      percent1RmLow: null,
      percent1RmHigh: null,
    },
    records,
    2.5,
  ),
  null,
);
assert.equal(
  getSuggestedLoad(
    {
      exerciseId: 'bench_press',
      percent1RmLow: 75,
      percent1RmHigh: 75,
    },
    records,
    2.5,
  ),
  null,
);
assert.equal(
  needsOneRmRecord({
    exerciseId: 'bench_press',
    percent1RmLow: 75,
    percent1RmHigh: null,
  }),
  true,
);
assert.equal(
  needsOneRmRecord({
    exerciseId: 'bench_press',
    percent1RmLow: null,
    percent1RmHigh: null,
  }),
  false,
);

console.log('suggested load verified');
