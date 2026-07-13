import { programSeed } from '../data/programSeed.ts';
import type { TrainingDatabase } from './database.ts';

type ProgramSeed = typeof programSeed;
type PhaseCode = keyof ProgramSeed['phaseWeeks'];

export type ProgramSeedRowInput = {
  programYearId: string;
  programName: string;
  startDate: string;
  endDate: string;
  recordedAt: string;
};

export type ProgramSeedRows = ReturnType<typeof buildProgramSeedRows>;

export async function saveProgramSeedRows(
  db: TrainingDatabase,
  input: ProgramSeedRowInput,
  seed: ProgramSeed = programSeed,
) {
  const rows = buildProgramSeedRows(input, seed);

  await db.execAsync('BEGIN TRANSACTION');
  try {
    await insertRows(db, 'program_years', rows.programYears);
    await insertRows(db, 'program_phases', rows.programPhases);
    await insertRows(db, 'program_blocks', rows.programBlocks);
    await insertRows(db, 'program_weeks', rows.programWeeks);
    await insertRows(db, 'exercises', rows.exercises);
    await insertRows(db, 'muscles', rows.muscles);
    await insertRows(db, 'program_workouts', rows.programWorkouts);
    await insertRows(db, 'program_exercises', rows.programExercises);
    await insertRows(
      db,
      'program_set_prescriptions',
      rows.programSetPrescriptions,
    );
    await insertRows(db, 'exercise_muscles', rows.exerciseMuscles);
    await insertRows(db, 'exercise_alternatives', rows.exerciseAlternatives);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export function buildProgramSeedRows(
  input: ProgramSeedRowInput,
  seed: ProgramSeed = programSeed,
) {
  const phaseByCode = new Map(seed.phases.map((phase) => [phase.code, phase]));

  const programYears = [
    {
      id: input.programYearId,
      name: input.programName,
      start_date: input.startDate,
      end_date: input.endDate,
      calendar_mode: 'sequence',
      is_active: 1,
      created_at: input.recordedAt,
      updated_at: input.recordedAt,
    },
  ];

  const programBlocks = seed.blocks.map((block) => ({
    id: block.id,
    program_year_id: input.programYearId,
    block_number: block.blockNumber,
    name: `Block ${block.blockNumber}`,
    phase_code: block.phaseCode,
    start_date: null,
    end_date: null,
    purpose: phaseByCode.get(block.phaseCode)?.primaryGoal ?? null,
    sort_order: block.blockNumber,
    created_at: input.recordedAt,
    updated_at: input.recordedAt,
  }));

  const programPhases = seed.phases.map((phase) => ({
    id: phase.id,
    code: phase.code,
    name: phase.name,
    default_weeks: phase.defaultWeeks,
    primary_goal: phase.primaryGoal,
    notes: null,
    created_at: input.recordedAt,
    updated_at: input.recordedAt,
  }));

  const programWeeks = seed.annualWeeks.map((week) => ({
    id: `year_week_${week.yearWeekNumber}`,
    program_block_id: week.blockId,
    week_number: week.yearWeekNumber,
    name: `Week ${week.yearWeekNumber}`,
    focus: week.phaseCode
      ? phaseByCode.get(week.phaseCode)?.primaryGoal ?? null
      : null,
    week_type: week.weekType,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: input.recordedAt,
    updated_at: input.recordedAt,
  }));

  const programWorkouts = [];
  const programExercises = [];
  const programSetPrescriptions = [];

  for (const week of seed.annualWeeks) {
    const phaseWeek =
      week.phaseCode && week.phaseWeekNumber
        ? seed.phaseWeeks[week.phaseCode as PhaseCode].find(
            (candidate) => candidate.weekNumber === week.phaseWeekNumber,
          )
        : null;

    for (const [workoutIndex, workout] of (phaseWeek?.workouts ?? []).entries()) {
      const workoutId = `year_week_${week.yearWeekNumber}_workout_${workoutIndex + 1}_${workout.id}`;
      programWorkouts.push({
        id: workoutId,
        program_week_id: `year_week_${week.yearWeekNumber}`,
        day_number: workout.dayNumber,
        scheduled_weekday: workout.scheduledWeekday,
        name: workout.name,
        focus: null,
        workout_type: workout.workoutType,
        estimated_duration_min: workout.estimatedDurationMin,
        notes: null,
        created_at: input.recordedAt,
        updated_at: input.recordedAt,
      });

      for (const exercise of workout.exercises) {
        const exerciseRowId = `${workoutId}_exercise_${exercise.sortOrder}`;
        programExercises.push({
          id: exerciseRowId,
          program_workout_id: workoutId,
          exercise_id: exercise.exerciseId,
          sort_order: exercise.sortOrder,
          exercise_role: exercise.role,
          prescription_label: null,
          is_top_set: exercise.isTopSet ? 1 : 0,
          is_backoff: exercise.isBackoff ? 1 : 0,
          is_optional: exercise.isOptional ? 1 : 0,
          superset_group: exercise.supersetGroup,
          notes: null,
          created_at: input.recordedAt,
          updated_at: input.recordedAt,
        });

        for (const prescription of exercise.prescriptions) {
          programSetPrescriptions.push({
            id: `${exerciseRowId}_set_${prescription.setOrder}`,
            program_exercise_id: exerciseRowId,
            set_order: prescription.setOrder,
            set_type: prescription.setType,
            target_sets: prescription.targetSets,
            target_reps_min: prescription.targetRepsMin,
            target_reps_max: prescription.targetRepsMax,
            target_reps_text: prescription.targetRepsText,
            percent_1rm_low: prescription.percent1RmLow,
            percent_1rm_high: prescription.percent1RmHigh,
            target_rpe_low: prescription.targetRpeLow,
            target_rpe_high: prescription.targetRpeHigh,
            rest_seconds_min: prescription.restSecondsMin,
            rest_seconds_max: prescription.restSecondsMax,
            tempo: prescription.tempo,
            notes: null,
            created_at: input.recordedAt,
            updated_at: input.recordedAt,
          });
        }
      }
    }
  }

  const exercises = seed.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    movement_pattern: exercise.movementPattern,
    equipment: exercise.equipment,
    default_role: exercise.defaultRole,
    is_unilateral: exercise.isUnilateral ? 1 : 0,
    is_bodyweight: exercise.isBodyweight ? 1 : 0,
    instructions: null,
    program_notes: null,
    user_notes: null,
    created_at: input.recordedAt,
    updated_at: input.recordedAt,
  }));

  const muscles = seed.muscles.map((muscle) => ({
    id: muscle.id,
    name: muscle.name,
    region:
      muscle.heatmapView === 'front' || muscle.heatmapView === 'back'
        ? muscle.heatmapView
        : 'both',
    parent_group: muscle.region,
    svg_path_id_front:
      muscle.heatmapView === 'front' || muscle.heatmapView === 'front_back'
        ? muscle.id
        : null,
    svg_path_id_back:
      muscle.heatmapView === 'back' || muscle.heatmapView === 'front_back'
        ? muscle.id
        : null,
    created_at: input.recordedAt,
    updated_at: input.recordedAt,
  }));

  const exerciseMuscles = seed.exercises.flatMap((exercise) =>
    exercise.muscles.map((muscle) => ({
      id: `${exercise.id}_${muscle.muscleId}`,
      exercise_id: exercise.id,
      muscle_id: muscle.muscleId,
      involvement_type: muscle.role,
      contribution_weight: muscle.heatmapWeight,
      created_at: input.recordedAt,
      updated_at: input.recordedAt,
    })),
  );

  const exerciseAlternatives = seed.exerciseAlternatives.map((alternative) => ({
    id: `${alternative.sourceExerciseId}_${alternative.alternativeExerciseId}`,
    source_exercise_id: alternative.sourceExerciseId,
    alternative_exercise_id: alternative.alternativeExerciseId,
    compatibility_score: alternative.compatibilityScore,
    reason: null,
    same_primary_muscles: alternative.sharedPrimaryMuscles.length > 0 ? 1 : 0,
    same_movement_pattern: alternative.sameMovementPattern ? 1 : 0,
    same_role: 1,
    created_at: input.recordedAt,
    updated_at: input.recordedAt,
  }));

  return {
    programYears,
    programBlocks,
    programPhases,
    programWeeks,
    programWorkouts,
    programExercises,
    programSetPrescriptions,
    exercises,
    muscles,
    exerciseMuscles,
    exerciseAlternatives,
  };
}

async function insertRows(
  db: TrainingDatabase,
  table: string,
  rows: readonly Record<string, string | number | null>[],
) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...Object.values(row),
    );
  }
}
