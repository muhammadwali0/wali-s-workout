export type WeightUnit = 'kg' | 'lb';
export type CalendarMode = 'program_week' | 'calendar_month';
export type AppTheme = 'scholar_light' | 'scholar_dark';

export type AppSettings = {
  preferredUnit: WeightUnit;
  barbellWeight: number;
  plateIncrement: number;
  dumbbellIncrement: number;
  machineIncrement: number;
  theme: AppTheme;
  setupCompleted: boolean;
  calendarMode: CalendarMode;
  restAlertSound: boolean;
  restAlertVibration: boolean;
};

export const defaultSettings: AppSettings = {
  preferredUnit: 'kg',
  barbellWeight: 20,
  plateIncrement: 2.5,
  dumbbellIncrement: 2.5,
  machineIncrement: 5,
  theme: 'scholar_light',
  setupCompleted: false,
  calendarMode: 'program_week',
  restAlertSound: true,
  restAlertVibration: true,
};

export function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  const merged = { ...defaultSettings, ...settings };
  merged.setupCompleted = Boolean(merged.setupCompleted);
  merged.restAlertSound = Boolean(merged.restAlertSound);
  merged.restAlertVibration = Boolean(merged.restAlertVibration);
  if (!['scholar_light', 'scholar_dark'].includes(merged.theme)) {
    merged.theme = defaultSettings.theme;
  }
  if (!['program_week', 'calendar_month'].includes(merged.calendarMode)) {
    merged.calendarMode = defaultSettings.calendarMode;
  }
  validatePositive(merged.barbellWeight, 'barbellWeight');
  validatePositive(merged.plateIncrement, 'plateIncrement');
  validatePositive(merged.dumbbellIncrement, 'dumbbellIncrement');
  validatePositive(merged.machineIncrement, 'machineIncrement');

  return merged;
}

function validatePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}
