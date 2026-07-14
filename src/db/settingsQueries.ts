import {
  defaultSettings,
  normalizeSettings,
  type AppSettings,
} from '../domain/settings/appSettings.ts';
import type { TrainingDatabase } from './database.ts';

const settingsId = 'default';

type SettingsRow = {
  preferredUnit: AppSettings['preferredUnit'];
  barbellWeight: number;
  plateIncrement: number;
  dumbbellIncrement: number;
  machineIncrement: number;
  theme: AppSettings['theme'];
  setupCompleted: number;
};

export async function getAppSettings(
  db: Pick<TrainingDatabase, 'getAllAsync' | 'runAsync'>,
): Promise<AppSettings> {
  await ensureAppSettings(db);
  const rows = await db.getAllAsync<SettingsRow>(
    `SELECT
       preferred_unit AS preferredUnit,
       barbell_weight AS barbellWeight,
       plate_increment AS plateIncrement,
       dumbbell_increment AS dumbbellIncrement,
       machine_increment AS machineIncrement,
       theme,
       setup_completed AS setupCompleted
     FROM app_settings
     WHERE id = ?`,
    settingsId,
  );

  const row = rows[0];
  return normalizeSettings(
    row ? { ...row, setupCompleted: row.setupCompleted === 1 } : defaultSettings,
  );
}

export async function saveAppSettings(
  db: Pick<TrainingDatabase, 'runAsync'>,
  settings: Partial<AppSettings>,
): Promise<AppSettings> {
  const next = normalizeSettings(settings);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (
       id,
       preferred_unit,
       barbell_weight,
       plate_increment,
       dumbbell_increment,
       machine_increment,
       theme,
       setup_completed,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    settingsId,
    next.preferredUnit,
    next.barbellWeight,
    next.plateIncrement,
    next.dumbbellIncrement,
    next.machineIncrement,
    next.theme,
    next.setupCompleted ? 1 : 0,
    now,
    now,
  );

  return next;
}

async function ensureAppSettings(db: Pick<TrainingDatabase, 'runAsync'>) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO app_settings (
       id,
       preferred_unit,
       barbell_weight,
       plate_increment,
       dumbbell_increment,
       machine_increment,
       theme,
       setup_completed,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    settingsId,
    defaultSettings.preferredUnit,
    defaultSettings.barbellWeight,
    defaultSettings.plateIncrement,
    defaultSettings.dumbbellIncrement,
    defaultSettings.machineIncrement,
    defaultSettings.theme,
    defaultSettings.setupCompleted ? 1 : 0,
    now,
    now,
  );
}
