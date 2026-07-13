import assert from 'node:assert/strict';

const { buildProgramSeedRows, saveProgramSeedRows } = await import(
  '../src/db/programSeedRows.ts'
);

const input = {
  programYearId: 'year_2026',
  programName: 'Training Year',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  recordedAt: '2026-01-01T00:00:00Z',
};
const expectedRows = buildProgramSeedRows(input);
const expectedInsertCount = Object.values(expectedRows).reduce(
  (total, rows) => total + rows.length,
  0,
);
const calls = [];
const db = {
  async execAsync(sql) {
    calls.push({ type: 'exec', sql });
  },
  async runAsync(sql, ...params) {
    calls.push({ type: 'run', sql, params });
  },
};

await saveProgramSeedRows(db, input);

assert.deepEqual(calls[0], { type: 'exec', sql: 'BEGIN TRANSACTION' });
assert.deepEqual(calls.at(-1), { type: 'exec', sql: 'COMMIT' });
assert.equal(calls.filter((call) => call.type === 'run').length, expectedInsertCount);
assert.match(calls[1].sql, /^INSERT OR REPLACE INTO program_years /);
assert.match(
  calls.find((call) => call.sql?.startsWith('INSERT OR REPLACE INTO program_exercises'))
    ?.sql,
  /^INSERT OR REPLACE INTO program_exercises /,
);
assert.equal(
  calls.find((call) => call.sql?.startsWith('INSERT OR REPLACE INTO muscles'))?.params[2],
  'front',
);

console.log('program seed save verified');
