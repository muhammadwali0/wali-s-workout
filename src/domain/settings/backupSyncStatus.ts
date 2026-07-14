export type BackupSyncStatus = {
  exportedAt: string;
  totalRows: number;
  isCurrentSchema: boolean;
  summary: string;
};

export function getBackupSyncStatus(input: {
  exportedAt: string;
  schemaVersion: number;
  totalRows: number;
}): BackupSyncStatus {
  const isCurrentSchema = input.schemaVersion === 1;
  return {
    exportedAt: input.exportedAt,
    totalRows: input.totalRows,
    isCurrentSchema,
    summary: `${input.totalRows} rows - schema ${input.schemaVersion} - ${
      isCurrentSchema ? 'ready to restore' : 'needs migration'
    }`,
  };
}
