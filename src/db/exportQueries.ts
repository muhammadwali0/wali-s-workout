import type { TrainingDatabase } from './database.ts';

const backupTables = [
  'app_settings',
  'notification_settings',
  'scheduled_notifications',
  'workout_instances',
  'workout_logs',
  'exercise_logs',
  'set_logs',
  'program_modifications',
  'one_rm_records',
  'personal_records',
] as const;

export type ExportTable = (typeof backupTables)[number];
export type ExportRow = Record<string, string | number | null>;

export type TrainingDataExport = {
  exportedAt: string;
  schemaVersion: number;
  tables: Record<ExportTable, ExportRow[]>;
};

export type ExportFile = {
  name: string;
  content: string;
};

export async function getTrainingDataExport(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  exportedAt = new Date().toISOString(),
): Promise<TrainingDataExport> {
  const tables = {} as Record<ExportTable, ExportRow[]>;

  for (const table of backupTables) {
    tables[table] = await db.getAllAsync<ExportRow>(`SELECT * FROM ${table}`);
  }

  return {
    exportedAt,
    schemaVersion: 1,
    tables,
  };
}

export function buildExportFiles(snapshot: TrainingDataExport): ExportFile[] {
  const stamp = snapshot.exportedAt.slice(0, 10);

  return [
    {
      name: `walis-workout-backup-${stamp}.json`,
      content: `${JSON.stringify(snapshot, null, 2)}\n`,
    },
    {
      name: `walis-workout-workout-logs-${stamp}.csv`,
      content: toCsv(snapshot.tables.workout_logs),
    },
    {
      name: `walis-workout-set-logs-${stamp}.csv`,
      content: toCsv(snapshot.tables.set_logs),
    },
    {
      name: `walis-workout-personal-records-${stamp}.csv`,
      content: toCsv(snapshot.tables.personal_records),
    },
  ];
}

export function toCsv(rows: readonly ExportRow[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columns.length === 0) return '\n';

  return `${columns.map(escapeCsvCell).join(',')}\n${rows
    .map((row) => columns.map((column) => escapeCsvCell(row[column])).join(','))
    .join('\n')}\n`;
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
