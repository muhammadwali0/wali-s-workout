import assert from 'node:assert/strict';

const { getPhaseTransitionSummary } = await import(
  '../src/domain/program/phaseTransition.ts'
);

assert.equal(
  getPhaseTransitionSummary(
    {
      status: 'in_year',
      dayOfWeek: 1,
      week: {
        yearWeekNumber: 37,
        blockNumber: 3,
        phaseCode: null,
        phaseWeekNumber: null,
        weekType: 'buffer',
        isBuffer: true,
        startDate: '2026-09-09',
        endDate: '2026-09-15',
      },
    },
    [],
  )?.nextBlockId,
  'block_4',
);

assert.deepEqual(
  getPhaseTransitionSummary(
    {
      status: 'in_year',
      dayOfWeek: 1,
      week: {
        yearWeekNumber: 37,
        blockNumber: 3,
        phaseCode: null,
        phaseWeekNumber: null,
        weekType: 'buffer',
        isBuffer: true,
        startDate: '2026-09-09',
        endDate: '2026-09-15',
      },
    },
    [
      {
        id: 'a',
        exerciseId: 'squat',
        value: 180,
        unit: 'kg',
        recordType: 'tested',
        programBlockId: 'block_3',
        recordedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'b',
        exerciseId: 'bench',
        value: 120,
        unit: 'kg',
        recordType: 'phase_end',
        programBlockId: 'block_3',
        recordedAt: '2026-09-01T00:00:00Z',
      },
    ],
  ),
  {
    sourceBlockNumber: 3,
    nextBlockNumber: 4,
    nextBlockId: 'block_4',
    phaseCode: 'phase2',
    baselineCount: 2,
    testedCount: 1,
    phaseEndCount: 1,
  },
);

assert.equal(
  getPhaseTransitionSummary(
    {
      status: 'in_year',
      dayOfWeek: 1,
      week: {
        yearWeekNumber: 40,
        blockNumber: 4,
        phaseCode: 'phase2',
        phaseWeekNumber: 1,
        weekType: 'normal',
        isBuffer: false,
        startDate: '2026-10-01',
        endDate: '2026-10-07',
      },
    },
    [],
  ),
  null,
);

console.log('phase transition verified');
