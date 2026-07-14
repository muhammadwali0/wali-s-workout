import assert from 'node:assert/strict';

const { getAppSettings, saveAppSettings } = await import(
  '../src/db/settingsQueries.ts'
);

const runCalls = [];
const db = {
  async runAsync(sql, ...params) {
    runCalls.push({ sql, params });
  },
  async getAllAsync() {
    return [
      {
        preferredUnit: 'kg',
        barbellWeight: 20,
        plateIncrement: 1.25,
        dumbbellIncrement: 2.5,
        machineIncrement: 5,
        theme: 'scholar_light',
        setupCompleted: 1,
      },
    ];
  },
};

assert.equal((await getAppSettings(db)).plateIncrement, 1.25);
assert.equal((await getAppSettings(db)).setupCompleted, true);
assert.match(runCalls[0].sql, /INSERT OR IGNORE INTO app_settings/);

const saved = await saveAppSettings(db, {
  preferredUnit: 'lb',
  barbellWeight: 45,
  plateIncrement: 5,
  dumbbellIncrement: 5,
  machineIncrement: 10,
  theme: 'scholar_light',
  setupCompleted: true,
});
assert.equal(saved.preferredUnit, 'lb');
assert.match(runCalls[2].sql, /INSERT OR REPLACE INTO app_settings/);
assert.deepEqual(runCalls[2].params.slice(1, 8), [
  'lb',
  45,
  5,
  5,
  10,
  'scholar_light',
  1,
]);

console.log('settings queries verified');
