import assert from 'node:assert/strict';

const { getCurrentOneRmRecords, saveOneRmRecord } = await import(
  '../src/db/oneRmQueries.ts'
);

const rows = [
  {
    id: 'back_squat_current_working_2026-01-01T00:00:00Z',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    value: 150,
    unit: 'kg',
    recordType: 'current_working',
    programBlockId: null,
    recordedAt: '2026-01-01T00:00:00Z',
  },
];
const getCalls = [];
const getDb = {
  async getAllAsync(sql) {
    getCalls.push(sql);
    return rows;
  },
};

assert.deepEqual(await getCurrentOneRmRecords(getDb), rows);
assert.match(getCalls[0], /FROM one_rm_records/);
assert.match(getCalls[0], /JOIN exercises/);
assert.match(getCalls[0], /NOT EXISTS/);
assert.match(getCalls[0], /ORDER BY e\.name/);

const runCalls = [];
const runDb = {
  async runAsync(sql, ...params) {
    runCalls.push({ sql, params });
  },
};
const record = await saveOneRmRecord(runDb, {
  exerciseId: 'bench_press',
  value: 100,
  unit: 'kg',
  recordedAt: '2026-02-01T00:00:00Z',
});

assert.equal(record.id, 'bench_press_current_working_2026-02-01T00:00:00Z');
assert.match(runCalls[0].sql, /INSERT OR REPLACE INTO one_rm_records/);
assert.deepEqual(runCalls[0].params.slice(0, 7), [
  'bench_press_current_working_2026-02-01T00:00:00Z',
  'bench_press',
  100,
  'kg',
  'current_working',
  null,
  '2026-02-01T00:00:00Z',
]);

console.log('1RM queries verified');
