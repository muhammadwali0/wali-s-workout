import assert from 'node:assert/strict';

const { compareBlocks, comparePhases } = await import(
  '../src/domain/analytics/blockComparison.ts'
);

const sets = [
  {
    blockNumber: 2,
    phaseCode: 'phase2',
    setType: 'working',
    completed: true,
    weight: 100,
    reps: 6,
  },
  {
    blockNumber: 1,
    phaseCode: 'phase1',
    setType: 'working',
    completed: true,
    weight: 80,
    reps: 5,
  },
  {
    blockNumber: 4,
    phaseCode: 'phase2',
    setType: 'working',
    completed: true,
    weight: 70,
    reps: 5,
  },
  {
    blockNumber: 1,
    phaseCode: 'phase1',
    setType: 'warmup',
    completed: true,
    weight: 60,
    reps: 5,
  },
  {
    blockNumber: null,
    phaseCode: null,
    setType: 'working',
    completed: true,
    weight: 90,
    reps: 5,
  },
];

assert.deepEqual(
  compareBlocks(sets),
  [
    {
      blockNumber: 1,
      phaseCode: 'phase1',
      totalVolume: 400,
      workingSets: 1,
    },
    {
      blockNumber: 2,
      phaseCode: 'phase2',
      totalVolume: 600,
      workingSets: 1,
    },
    {
      blockNumber: 4,
      phaseCode: 'phase2',
      totalVolume: 350,
      workingSets: 1,
    },
  ],
);
assert.deepEqual(
  comparePhases(sets),
  [
    {
      phaseCode: 'phase1',
      totalVolume: 400,
      workingSets: 1,
    },
    {
      phaseCode: 'phase2',
      totalVolume: 950,
      workingSets: 2,
    },
  ],
);

console.log('block comparison verified');
