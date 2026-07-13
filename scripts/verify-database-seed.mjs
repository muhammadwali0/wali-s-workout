import assert from 'node:assert/strict';

const { ensureProgramSeeded } = await import('../src/db/programSeedRows.ts');

const emptyCalls = [];
const emptyDb = {
  async getFirstAsync(sql) {
    emptyCalls.push({ type: 'getFirst', sql });
    return { count: 0 };
  },
  async execAsync(sql) {
    emptyCalls.push({ type: 'exec', sql });
  },
  async runAsync(sql, ...params) {
    emptyCalls.push({ type: 'run', sql, params });
  },
};

const seeded = await ensureProgramSeeded(
  emptyDb,
  new Date('2026-07-14T00:00:00Z'),
);
assert.equal(seeded, true);
assert.equal(emptyCalls[0].sql, 'SELECT COUNT(*) AS count FROM program_years');
assert.equal(emptyCalls[1].sql, 'BEGIN TRANSACTION');
assert.equal(emptyCalls.at(-1).sql, 'COMMIT');
assert.equal(
  emptyCalls.find((call) => call.sql?.startsWith('INSERT OR REPLACE INTO program_years'))
    ?.params[0],
  'training_year_2026',
);

const populatedCalls = [];
const populatedDb = {
  async getFirstAsync(sql) {
    populatedCalls.push({ type: 'getFirst', sql });
    return { count: 1 };
  },
  async execAsync(sql) {
    populatedCalls.push({ type: 'exec', sql });
  },
  async runAsync(sql, ...params) {
    populatedCalls.push({ type: 'run', sql, params });
  },
};

assert.equal(
  await ensureProgramSeeded(populatedDb, new Date('2026-07-14T00:00:00Z')),
  false,
);
assert.equal(populatedCalls.length, 1);

console.log('database seed initialization verified');
