import * as SQLite from 'expo-sqlite';

import {
  createSchemaSql,
  databaseName,
  expectedTables,
  schemaVersion,
  type AppTable,
} from './schema.ts';
import { ensureProgramSeeded } from './programSeedRows.ts';

export type TrainingDatabase = SQLite.SQLiteDatabase;

export async function openTrainingDatabase() {
  const db = await SQLite.openDatabaseAsync(databaseName);
  await migrateDatabase(db);
  await ensureProgramSeeded(db);
  return db;
}

export async function migrateDatabase(db: TrainingDatabase) {
  await db.execAsync(createSchemaSql);
  await db.runAsync(
    'ALTER TABLE app_settings ADD COLUMN setup_completed INTEGER NOT NULL DEFAULT 0',
  ).catch(() => undefined);
  await db.runAsync(
    "ALTER TABLE app_settings ADD COLUMN calendar_mode TEXT NOT NULL DEFAULT 'program_week'",
  ).catch(() => undefined);
  await db.runAsync(
    'ALTER TABLE app_settings ADD COLUMN rest_alert_sound INTEGER NOT NULL DEFAULT 1',
  ).catch(() => undefined);
  await db.runAsync(
    'ALTER TABLE app_settings ADD COLUMN rest_alert_vibration INTEGER NOT NULL DEFAULT 1',
  ).catch(() => undefined);
  await db.runAsync(
    'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
    schemaVersion,
    new Date().toISOString(),
  );
}

export async function listAppTables(db: TrainingDatabase): Promise<AppTable[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  return rows
    .map((row) => row.name)
    .filter((name): name is AppTable =>
      expectedTables.includes(name as AppTable),
    );
}
