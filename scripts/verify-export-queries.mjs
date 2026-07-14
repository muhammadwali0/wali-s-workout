import assert from 'node:assert/strict';

const {
  buildExportFiles,
  getTrainingDataExport,
  previewTrainingDataExport,
  resetNotificationData,
  resetUserTrainingData,
  restoreTrainingDataExport,
  toCsv,
} = await import(
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
  async execAsync(sql) {
    calls.push(sql);
  },
  async runAsync(sql, ...params) {
    calls.push({ sql, params });
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

const preview = previewTrainingDataExport(files[0].content);
assert.equal(preview.schemaVersion, 1);
assert.equal(preview.tableCounts.workout_logs, 1);
assert.equal(preview.tableCounts.set_logs, 1);
assert.equal(preview.totalRows, 3);

await resetUserTrainingData(db);
assert.deepEqual(
  calls
    .filter((call) => typeof call === 'object' && call.sql.startsWith('DELETE FROM'))
    .slice(0, 3)
    .map((call) => call.sql),
  ['DELETE FROM personal_records', 'DELETE FROM set_logs', 'DELETE FROM exercise_logs'],
);

calls.length = 0;
await resetNotificationData(db);
assert.deepEqual(
  calls.map((call) => call.sql),
  ['DELETE FROM scheduled_notifications', 'DELETE FROM notification_settings'],
);

calls.length = 0;
await restoreTrainingDataExport(db, files[0].content);
assert.equal(calls[0], 'BEGIN TRANSACTION');
assert.ok(
  calls.some(
    (call) =>
      typeof call === 'object' &&
      call.sql.startsWith('INSERT OR REPLACE INTO workout_logs') &&
      call.params.includes('log_1'),
  ),
);
assert.ok(
  calls.some(
    (call) =>
      typeof call === 'object' &&
      call.sql.startsWith('INSERT OR REPLACE INTO set_logs') &&
      call.params.includes('set_1'),
  ),
);
assert.equal(calls.at(-1), 'COMMIT');
await assert.rejects(restoreTrainingDataExport(db, '{}'), /Invalid backup|missing/);

console.log('export queries verified');
