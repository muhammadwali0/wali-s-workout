import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');

const requiredTables = [
  'program_years',
  'program_blocks',
  'program_phases',
  'program_weeks',
  'program_workouts',
  'program_exercises',
  'program_set_prescriptions',
  'exercises',
  'muscles',
  'exercise_muscles',
  'exercise_alternatives',
  'one_rm_records',
  'workout_instances',
  'workout_logs',
  'exercise_logs',
  'set_logs',
  'program_modifications',
  'personal_records',
  'notification_settings',
  'scheduled_notifications',
  'app_settings',
];

const missing = requiredTables.filter(
  (table) => !schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
);

if (missing.length > 0) {
  console.error(`Missing schema tables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`schema verified: ${requiredTables.length} app tables`);
