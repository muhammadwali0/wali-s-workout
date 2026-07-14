import assert from 'node:assert/strict';

const { defaultSettings, normalizeSettings } = await import(
  '../src/domain/settings/appSettings.ts'
);

assert.deepEqual(defaultSettings, {
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
});
assert.deepEqual(normalizeSettings({ preferredUnit: 'lb', barbellWeight: 45 }), {
  ...defaultSettings,
  preferredUnit: 'lb',
  barbellWeight: 45,
});
assert.equal(normalizeSettings({ setupCompleted: true }).setupCompleted, true);
assert.equal(normalizeSettings({ theme: 'scholar_dark' }).theme, 'scholar_dark');
assert.equal(normalizeSettings({ theme: 'neon' }).theme, 'scholar_light');
assert.equal(
  normalizeSettings({ calendarMode: 'calendar_month' }).calendarMode,
  'calendar_month',
);
assert.equal(normalizeSettings({ restAlertSound: false }).restAlertSound, false);
assert.throws(() => normalizeSettings({ plateIncrement: 0 }), /plateIncrement/);

console.log('settings verified');
