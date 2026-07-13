export type WeightUnit = 'kg' | 'lb';

export type AppSettings = {
  preferredUnit: WeightUnit;
  barbellWeight: number;
  plateIncrement: number;
  dumbbellIncrement: number;
  machineIncrement: number;
  theme: 'scholar_light';
};

export const defaultSettings: AppSettings = {
  preferredUnit: 'kg',
  barbellWeight: 20,
  plateIncrement: 2.5,
  dumbbellIncrement: 2.5,
  machineIncrement: 5,
  theme: 'scholar_light',
};

export function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  const merged = { ...defaultSettings, ...settings };
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
