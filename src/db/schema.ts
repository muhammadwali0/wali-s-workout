export const databaseName = 'walis_workout.db';

export const schemaVersion = 1;

export const expectedTables = [
  'schema_migrations',
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
] as const;

export type AppTable = (typeof expectedTables)[number];

export const createSchemaSql = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  calendar_mode TEXT NOT NULL CHECK (calendar_mode IN ('fixed_dates', 'sequence')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_blocks (
  id TEXT PRIMARY KEY,
  program_year_id TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  phase_code TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  purpose TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_year_id) REFERENCES program_years(id)
);

CREATE TABLE IF NOT EXISTS program_phases (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_weeks INTEGER NOT NULL,
  primary_goal TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_weeks (
  id TEXT PRIMARY KEY,
  program_block_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  name TEXT,
  focus TEXT,
  week_type TEXT NOT NULL CHECK (week_type IN (
    'normal',
    'deload',
    'semi_deload',
    'taper',
    'test',
    'buffer',
    'transition'
  )),
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_block_id) REFERENCES program_blocks(id)
);

CREATE TABLE IF NOT EXISTS program_workouts (
  id TEXT PRIMARY KEY,
  program_week_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  scheduled_weekday INTEGER,
  name TEXT NOT NULL,
  focus TEXT,
  workout_type TEXT NOT NULL CHECK (workout_type IN (
    'training',
    'rest',
    'test',
    'deload',
    'taper',
    'buffer'
  )),
  estimated_duration_min INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_week_id) REFERENCES program_weeks(id)
);

CREATE TABLE IF NOT EXISTS program_exercises (
  id TEXT PRIMARY KEY,
  program_workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  exercise_role TEXT NOT NULL CHECK (exercise_role IN ('primary', 'secondary', 'tertiary')),
  prescription_label TEXT,
  is_top_set INTEGER NOT NULL DEFAULT 0,
  is_backoff INTEGER NOT NULL DEFAULT 0,
  is_optional INTEGER NOT NULL DEFAULT 0,
  superset_group TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_workout_id) REFERENCES program_workouts(id),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS program_set_prescriptions (
  id TEXT PRIMARY KEY,
  program_exercise_id TEXT NOT NULL,
  set_order INTEGER NOT NULL,
  set_type TEXT NOT NULL CHECK (set_type IN (
    'warmup',
    'working',
    'top_set',
    'backoff',
    'amrap',
    'drop_set',
    'myo_rep',
    'static_hold',
    'technique'
  )),
  target_sets INTEGER NOT NULL DEFAULT 1,
  target_reps_min INTEGER,
  target_reps_max INTEGER,
  target_reps_text TEXT,
  percent_1rm_low REAL,
  percent_1rm_high REAL,
  target_rpe_low REAL,
  target_rpe_high REAL,
  rest_seconds_min INTEGER,
  rest_seconds_max INTEGER,
  tempo TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_exercise_id) REFERENCES program_exercises(id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  movement_pattern TEXT NOT NULL,
  equipment TEXT,
  default_role TEXT CHECK (default_role IN ('primary', 'secondary', 'tertiary')),
  is_unilateral INTEGER NOT NULL DEFAULT 0,
  is_bodyweight INTEGER NOT NULL DEFAULT 0,
  instructions TEXT,
  program_notes TEXT,
  user_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS muscles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL CHECK (region IN ('front', 'back', 'both')),
  parent_group TEXT,
  svg_path_id_front TEXT,
  svg_path_id_back TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_muscles (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  muscle_id TEXT NOT NULL,
  involvement_type TEXT NOT NULL CHECK (involvement_type IN ('primary', 'secondary', 'stabilizer')),
  contribution_weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (muscle_id) REFERENCES muscles(id)
);

CREATE TABLE IF NOT EXISTS exercise_alternatives (
  id TEXT PRIMARY KEY,
  source_exercise_id TEXT NOT NULL,
  alternative_exercise_id TEXT NOT NULL,
  compatibility_score INTEGER NOT NULL,
  reason TEXT,
  same_primary_muscles INTEGER NOT NULL DEFAULT 1,
  same_movement_pattern INTEGER NOT NULL DEFAULT 1,
  same_role INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (alternative_exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS one_rm_records (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb')),
  record_type TEXT NOT NULL CHECK (record_type IN (
    'starting',
    'current_working',
    'tested',
    'estimated',
    'block_baseline',
    'phase_end'
  )),
  program_block_id TEXT,
  program_phase_id TEXT,
  source_workout_log_id TEXT,
  source_set_log_id TEXT,
  recorded_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (program_block_id) REFERENCES program_blocks(id),
  FOREIGN KEY (program_phase_id) REFERENCES program_phases(id)
);

CREATE TABLE IF NOT EXISTS workout_instances (
  id TEXT PRIMARY KEY,
  program_workout_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  actual_date TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'scheduled',
    'in_progress',
    'completed',
    'skipped',
    'missed',
    'rescheduled'
  )),
  sequence_index INTEGER NOT NULL,
  was_shifted INTEGER NOT NULL DEFAULT 0,
  shift_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (program_workout_id) REFERENCES program_workouts(id)
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  workout_instance_id TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  duration_seconds INTEGER,
  status TEXT NOT NULL CHECK (status IN ('draft', 'completed', 'discarded')),
  average_rpe REAL,
  total_volume REAL,
  total_working_sets INTEGER,
  user_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workout_instance_id) REFERENCES workout_instances(id)
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id TEXT PRIMARY KEY,
  workout_log_id TEXT NOT NULL,
  program_exercise_id TEXT,
  exercise_id TEXT NOT NULL,
  original_exercise_id TEXT,
  was_substituted INTEGER NOT NULL DEFAULT 0,
  substitution_reason TEXT,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
  user_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id),
  FOREIGN KEY (program_exercise_id) REFERENCES program_exercises(id),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (original_exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY,
  exercise_log_id TEXT NOT NULL,
  program_set_prescription_id TEXT,
  set_order INTEGER NOT NULL,
  set_type TEXT NOT NULL,
  weight REAL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb')),
  reps INTEGER,
  rpe REAL,
  rir REAL,
  duration_seconds INTEGER,
  is_completed INTEGER NOT NULL DEFAULT 0,
  is_pr INTEGER NOT NULL DEFAULT 0,
  is_warmup INTEGER NOT NULL DEFAULT 0,
  is_failed INTEGER NOT NULL DEFAULT 0,
  user_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (exercise_log_id) REFERENCES exercise_logs(id),
  FOREIGN KEY (program_set_prescription_id) REFERENCES program_set_prescriptions(id)
);

CREATE TABLE IF NOT EXISTS program_modifications (
  id TEXT PRIMARY KEY,
  modification_type TEXT NOT NULL CHECK (modification_type IN (
    'replace_exercise',
    'change_sets',
    'change_reps',
    'change_rpe',
    'change_rest',
    'add_exercise',
    'remove_exercise',
    'reorder_exercise',
    'move_workout',
    'skip_workout'
  )),
  scope TEXT NOT NULL CHECK (scope IN (
    'today_only',
    'workout_instance',
    'week',
    'future_matching_in_block',
    'block',
    'year'
  )),
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  reason TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_records (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  set_log_id TEXT,
  workout_log_id TEXT,
  pr_type TEXT NOT NULL CHECK (pr_type IN (
    'max_weight',
    'rep_pr',
    'estimated_1rm',
    'volume_pr'
  )),
  weight REAL,
  reps INTEGER,
  estimated_1rm REAL,
  volume REAL,
  unit TEXT CHECK (unit IN ('kg', 'lb')),
  achieved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (set_log_id) REFERENCES set_logs(id),
  FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id)
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  workout_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  workout_reminder_time TEXT,
  missed_workout_enabled INTEGER NOT NULL DEFAULT 1,
  missed_workout_time TEXT,
  unfinished_session_enabled INTEGER NOT NULL DEFAULT 1,
  deload_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  test_week_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'workout_due',
    'missed_workout',
    'unfinished_session',
    'deload_week',
    'taper_week',
    'test_week',
    'phase_transition'
  )),
  related_entity_type TEXT,
  related_entity_id TEXT,
  scheduled_for TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  external_notification_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  preferred_unit TEXT NOT NULL CHECK (preferred_unit IN ('kg', 'lb')),
  barbell_weight REAL NOT NULL,
  plate_increment REAL NOT NULL,
  dumbbell_increment REAL NOT NULL,
  machine_increment REAL NOT NULL,
  theme TEXT NOT NULL DEFAULT 'scholar_light',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_instances_date ON workout_instances(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workout_instances_status ON workout_instances(status);
CREATE INDEX IF NOT EXISTS idx_workout_logs_instance ON workout_logs(workout_instance_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout ON exercise_logs(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_log ON set_logs(exercise_log_id);
CREATE INDEX IF NOT EXISTS idx_program_workouts_week ON program_workouts(program_week_id);
CREATE INDEX IF NOT EXISTS idx_program_exercises_workout ON program_exercises(program_workout_id);
CREATE INDEX IF NOT EXISTS idx_exercise_muscles_exercise ON exercise_muscles(exercise_id);
CREATE INDEX IF NOT EXISTS idx_one_rm_exercise_date ON one_rm_records(exercise_id, recorded_at);
`;
