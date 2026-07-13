import assert from 'node:assert/strict';

const {
  createOneRmRecord,
  getCurrentOneRm,
  transferPhaseEndToBlockBaseline,
} = await import('../src/domain/load/oneRmVault.ts');

const records = [
  createOneRmRecord({
    exerciseId: 'back_squat',
    value: 140,
    unit: 'kg',
    recordType: 'starting',
    programBlockId: 'block_1',
    recordedAt: '2026-01-01T00:00:00Z',
  }),
  createOneRmRecord({
    exerciseId: 'back_squat',
    value: 150,
    unit: 'kg',
    recordType: 'current_working',
    programBlockId: 'block_1',
    recordedAt: '2026-02-01T00:00:00Z',
  }),
  createOneRmRecord({
    exerciseId: 'bench_press',
    value: 100,
    unit: 'kg',
    recordType: 'current_working',
    programBlockId: 'block_1',
    recordedAt: '2026-02-01T00:00:00Z',
  }),
];

assert.equal(getCurrentOneRm(records, 'back_squat').value, 150);
assert.equal(getCurrentOneRm(records, 'missing'), null);
assert.throws(
  () =>
    createOneRmRecord({
      exerciseId: 'deadlift',
      value: 0,
      unit: 'kg',
      recordType: 'tested',
      programBlockId: null,
      recordedAt: '2026-01-01T00:00:00Z',
    }),
  /positive/,
);

const phaseEnd = createOneRmRecord({
  exerciseId: 'back_squat',
  value: 160,
  unit: 'kg',
  recordType: 'phase_end',
  programBlockId: 'block_3',
  recordedAt: '2026-09-30T00:00:00Z',
});
assert.deepEqual(
  transferPhaseEndToBlockBaseline(
    phaseEnd,
    'block_4',
    '2026-10-01T00:00:00Z',
  ),
  {
    id: 'back_squat_block_baseline_2026-10-01T00:00:00Z',
    exerciseId: 'back_squat',
    value: 160,
    unit: 'kg',
    recordType: 'block_baseline',
    programBlockId: 'block_4',
    recordedAt: '2026-10-01T00:00:00Z',
  },
);

console.log('1RM vault verified');
