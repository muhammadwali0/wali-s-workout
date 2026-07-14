import assert from 'node:assert/strict';

const { getBackupSyncStatus } = await import(
  '../src/domain/settings/backupSyncStatus.ts'
);

assert.deepEqual(
  getBackupSyncStatus({
    exportedAt: '2026-07-14T12:00:00.000Z',
    schemaVersion: 1,
    totalRows: 42,
  }),
  {
    exportedAt: '2026-07-14T12:00:00.000Z',
    totalRows: 42,
    isCurrentSchema: true,
    summary: '42 rows - schema 1 - ready to restore',
  },
);
assert.equal(
  getBackupSyncStatus({
    exportedAt: '2026-07-14T12:00:00.000Z',
    schemaVersion: 2,
    totalRows: 1,
  }).isCurrentSchema,
  false,
);

console.log('backup sync status verified');
