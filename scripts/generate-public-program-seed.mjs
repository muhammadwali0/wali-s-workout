import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const privateRoot = new URL('../data/program/', import.meta.url);
const outputUrl = new URL('../src/data/programSeed.ts', import.meta.url);

const annualPlan = readJson('annual_plan.json').annual_plan;
const phaseSeeds = {
  phase1: readJson('phase1.json').program,
  phase2: readJson('phase2.json').program,
  phase3: readJson('phase3.json').program,
};

const phases = Object.entries(phaseSeeds).map(([code, phase]) => ({
  id: code,
  code,
  name: titleCase(code.replace('phase', 'Phase ')),
  defaultWeeks: phase.default_weeks,
  primaryGoal: genericGoal(code),
}));

const blocks = annualPlan.blocks.map((block) => ({
  id: block.id,
  blockNumber: block.block_number,
  phaseCode: block.phase_code,
  yearWeekStart: block.year_week_start,
  yearWeekEnd: block.year_week_end,
  phaseWeekCount: block.phase_week_count,
  bufferWeekCount: block.buffer_week_count,
}));

const annualWeeks = annualPlan.weeks.map((week) => ({
  yearWeekNumber: week.year_week_number,
  blockId: week.block_id,
  blockNumber: week.block_number,
  phaseCode: week.phase_code,
  phaseWeekNumber: week.phase_week_number,
  weekType: week.week_type,
  isBuffer: week.is_buffer,
}));

const phaseWeeks = Object.fromEntries(
  Object.entries(phaseSeeds).map(([code, phase]) => [
    code,
    phase.weeks.map((week) => ({
      id: `${code}_week_${pad(week.week_number)}`,
      weekNumber: week.week_number,
      weekType: week.week_type,
      workouts: week.workouts.map((workout) =>
        sanitizeWorkout(code, week.week_number, workout),
      ),
    })),
  ]),
);

const exercises = annualPlan.exercise_library.map((exercise) => ({
  id: exercise.id,
  name: exercise.name,
  category: exercise.category,
  movementPattern: exercise.movement_pattern,
  equipment: exercise.equipment,
  defaultRole: exercise.default_role,
  isUnilateral: exercise.is_unilateral,
  isBodyweight: exercise.is_bodyweight,
  muscles: exercise.muscles.map((muscle) => ({
    muscleId: muscle.muscle_id,
    role: muscle.role,
    heatmapWeight: muscle.heatmap_weight,
  })),
}));
const muscles = annualPlan.muscles.map((muscle) => ({
  id: muscle.id,
  name: muscle.name,
  region: muscle.region,
  heatmapView: muscle.heatmap_view,
}));
const movementPatterns = annualPlan.movement_patterns;
const exerciseAlternatives = annualPlan.exercise_alternatives.map((alternative) => ({
  sourceExerciseId: alternative.source_exercise_id,
  alternativeExerciseId: alternative.alternative_exercise_id,
  compatibilityScore: alternative.compatibility_score,
  sameMovementPattern: alternative.same_movement_pattern,
  sharedPrimaryMuscles: alternative.shared_primary_muscles,
}));

const seed = {
  schemaVersion: 1,
  generatedFrom: 'sanitized-program-json',
  phases,
  blocks,
  annualWeeks,
  phaseWeeks,
  exercises,
  muscles,
  movementPatterns,
  exerciseAlternatives,
};

const text = `export const programSeed = ${JSON.stringify(seed, null, 2)} as const;\n`;
assertPublic(text);
mkdirSync(dirname(outputUrl.pathname), { recursive: true });
writeFileSync(outputUrl, text);
console.log(
  `wrote ${outputUrl.pathname}: ${annualWeeks.length} annual weeks, ${exercises.length} exercises`,
);

function readJson(fileName) {
  return JSON.parse(readFileSync(new URL(fileName, privateRoot), 'utf8'));
}

function sanitizeWorkout(phaseCode, weekNumber, workout) {
  const workoutId = `${phaseCode}_w${pad(weekNumber)}_d${workout.day_number}`;
  const mainExercises = workout.exercises
    .filter((exercise) => exercise.exercise_role === 'primary')
    .slice(0, 2)
    .map((exercise) => exercise.name);

  return {
    id: workoutId,
    dayNumber: workout.day_number,
    scheduledWeekday: workout.scheduled_weekday,
    name: `Day ${workout.day_number}: ${mainExercises.join(' / ') || 'Training'}`,
    workoutType: workout.workout_type,
    estimatedDurationMin: workout.estimated_duration_min,
    exercises: workout.exercises.map((exercise) =>
      sanitizeExercise(workoutId, exercise),
    ),
  };
}

function sanitizeExercise(workoutId, exercise) {
  const exerciseId = `${workoutId}_e${pad(exercise.sort_order)}`;

  return {
    id: exerciseId,
    exerciseId: exercise.exercise_id,
    name: exercise.name,
    sortOrder: exercise.sort_order,
    role: exercise.exercise_role,
    isTopSet: Boolean(exercise.is_top_set),
    isBackoff: Boolean(exercise.is_backoff),
    isOptional: Boolean(exercise.is_optional),
    supersetGroup: exercise.superset_group,
    prescriptions: exercise.prescriptions.map((prescription) => ({
      id: `${exerciseId}_s${pad(prescription.set_order)}`,
      setOrder: prescription.set_order,
      setType: prescription.set_type,
      targetSets: prescription.target_sets,
      targetRepsMin: prescription.target_reps_min,
      targetRepsMax: prescription.target_reps_max,
      targetRepsText: prescription.target_reps_text,
      percent1RmLow: prescription.percent_1rm_low,
      percent1RmHigh: prescription.percent_1rm_high,
      targetRpeLow: prescription.target_rpe_low,
      targetRpeHigh: prescription.target_rpe_high,
      restSecondsMin: prescription.rest_seconds_min,
      restSecondsMax: prescription.rest_seconds_max,
      tempo: prescription.tempo,
    })),
  };
}

function genericGoal(code) {
  if (code === 'phase1') return 'Foundation strength and hypertrophy';
  if (code === 'phase2') return 'Hypertrophy and work capacity';
  return 'Strength peak and testing';
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function assertPublic(text) {
  const blocked = [
    String.fromCharCode(115, 111, 117, 114, 99, 101, 95, 112, 100, 102),
    String.fromCharCode(115, 111, 117, 114, 99, 101, 95, 116, 114, 97, 99, 101),
  ];
  const match = blocked.find((pattern) => text.toLowerCase().includes(pattern));
  if (match) {
    throw new Error(`generated seed contains blocked pattern: ${match}`);
  }
}
