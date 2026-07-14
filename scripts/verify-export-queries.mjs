import assert from 'node:assert/strict';

const { buildExportFiles, getTrainingDataExport, toCsv } = await import(
  '../src/db/exportQueries.ts'
);

const calls = [];
const db = {
  async getAllAsync(sql) {
    calls.push(sql);
    if (sql.includes('workout_logs')) {
      return [
        {
          id: 'log_1',
          status: 'completed',
          user_notes: 'steady, controlled',
        },
      ];
    }
    if (sql.includes('set_logs')) {
      return [{ id: 'set_1', weight: 100, reps: 5, user_notes: 'bar "fast"' }];
    }
    if (sql.includes('personal_records')) {
      return [{ id: 'pr_1', pr_type: 'estimated_1rm', estimated_1rm: 120 }];
    }
    return [];
  },
};

const snapshot = await getTrainingDataExport(db, '2026-07-14T12:00:00.000Z');
assert.equal(snapshot.exportedAt, '2026-07-14T12:00:00.000Z');
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.tables.workout_logs[0].id, 'log_1');
assert.equal(snapshot.tables.set_logs[0].id, 'set_1');
assert.equal(snapshot.tables.personal_records[0].id, 'pr_1');
assert.ok(calls.some((sql) => sql === 'SELECT * FROM app_settings'));
assert.ok(calls.some((sql) => sql === 'SELECT * FROM workout_logs'));

const files = buildExportFiles(snapshot);
assert.deepEqual(
  files.map((file) => file.name),
  [
    'walis-workout-backup-2026-07-14.json',
    'walis-workout-workout-logs-2026-07-14.csv',
    'walis-workout-set-logs-2026-07-14.csv',
    'walis-workout-personal-records-2026-07-14.csv',
  ],
);
assert.match(files[0].content, /"schemaVersion": 1/);
assert.match(files[1].content, /"steady, controlled"/);
assert.match(files[2].content, /"bar ""fast"""/);
assert.equal(toCsv([]), '\n');

console.log('export queries verified');
