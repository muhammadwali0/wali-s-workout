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

const resetOrder: ExportTable[] = [
  'personal_records',
  'set_logs',
  'exercise_logs',
  'workout_logs',
  'scheduled_notifications',
  'program_modifications',
  'one_rm_records',
  'workout_instances',
  'notification_settings',
  'app_settings',
];

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

export type TrainingDataExportPreview = {
  exportedAt: string;
  schemaVersion: number;
  tableCounts: Record<ExportTable, number>;
  totalRows: number;
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

export function previewTrainingDataExport(json: string): TrainingDataExportPreview {
  const snapshot = parseTrainingDataExport(json);
  const tableCounts = {} as Record<ExportTable, number>;
  let totalRows = 0;

  for (const table of backupTables) {
    const count = snapshot.tables[table].length;
    tableCounts[table] = count;
    totalRows += count;
  }

  return {
    exportedAt: snapshot.exportedAt,
    schemaVersion: snapshot.schemaVersion,
    tableCounts,
    totalRows,
  };
}

export async function restoreTrainingDataExport(
  db: Pick<TrainingDatabase, 'execAsync' | 'runAsync'>,
  json: string,
) {
  const snapshot = parseTrainingDataExport(json);

  await db.execAsync('BEGIN TRANSACTION');
  try {
    await resetUserTrainingData(db);
    for (const table of backupTables) {
      for (const row of snapshot.tables[table]) {
        await insertRow(db, table, row);
      }
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export async function resetUserTrainingData(
  db: Pick<TrainingDatabase, 'runAsync'>,
) {
  for (const table of resetOrder) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
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

function parseTrainingDataExport(json: string): TrainingDataExport {
  const parsed = JSON.parse(json) as Partial<TrainingDataExport>;
  if (!parsed || typeof parsed !== 'object' || !parsed.tables) {
    throw new Error('Invalid backup JSON');
  }

  const tables = {} as Record<ExportTable, ExportRow[]>;
  for (const table of backupTables) {
    const rows = parsed.tables[table];
    if (!Array.isArray(rows)) {
      throw new Error(`Backup missing ${table}`);
    }
    tables[table] = rows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Invalid row in ${table}`);
      }
      return row as ExportRow;
    });
  }

  return {
    exportedAt:
      typeof parsed.exportedAt === 'string'
        ? parsed.exportedAt
        : new Date().toISOString(),
    schemaVersion: parsed.schemaVersion === 1 ? 1 : 1,
    tables,
  };
}

async function insertRow(
  db: Pick<TrainingDatabase, 'runAsync'>,
  table: ExportTable,
  row: ExportRow,
) {
  const columns = Object.keys(row);
  if (columns.length === 0) return;

  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns
      .map(() => '?')
      .join(', ')})`,
    ...columns.map((column) => row[column]),
  );
}
