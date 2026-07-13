import assert from 'node:assert/strict';

const { programSeed } = await import('../src/data/programSeed.ts');
const { buildProgramSeedRows } = await import('../src/db/programSeedRows.ts');

const rows = buildProgramSeedRows({
  programYearId: 'year_2026',
  programName: 'Training Year',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  recordedAt: '2026-01-01T00:00:00Z',
});

assert.equal(rows.programYears.length, 1);
assert.equal(rows.programBlocks.length, programSeed.blocks.length);
assert.equal(rows.programPhases.length, programSeed.phases.length);
assert.equal(rows.programWeeks.length, programSeed.annualWeeks.length);
assert.equal(rows.exercises.length, programSeed.exercises.length);
assert.equal(rows.muscles.length, programSeed.muscles.length);
assert.equal(rows.exerciseAlternatives.length, programSeed.exerciseAlternatives.length);
assert.equal(rows.programWorkouts.length, countAnnualWorkouts(programSeed));
assert.equal(rows.workoutInstances.length, rows.programWorkouts.length);
assert.equal(rows.programExercises.length, countAnnualExercises(programSeed));
assert.equal(rows.programSetPrescriptions.length, countAnnualPrescriptions(programSeed));
assert.equal(
  rows.exerciseMuscles.length,
  programSeed.exercises.reduce((total, exercise) => total + exercise.muscles.length, 0),
);

assert.equal(new Set(rows.programWorkouts.map((row) => row.id)).size, rows.programWorkouts.length);
assert.equal(
  new Set(rows.workoutInstances.map((row) => row.id)).size,
  rows.workoutInstances.length,
);
assert.equal(rows.workoutInstances[0].scheduled_date, '2026-01-01');
assert.equal(rows.workoutInstances[0].sequence_index, 1);
assert.equal(rows.workoutInstances.at(-1)?.status, 'scheduled');
assert.equal(new Set(rows.programExercises.map((row) => row.id)).size, rows.programExercises.length);
assert.equal(
  new Set(rows.programSetPrescriptions.map((row) => row.id)).size,
  rows.programSetPrescriptions.length,
);
assert.equal(
  rows.muscles.every((row) => ['front', 'back', 'both'].includes(row.region)),
  true,
);
assert.equal(rows.muscles.find((row) => row.id === 'abductors')?.region, 'both');

console.log('program seed rows verified');

function countAnnualWorkouts(seed) {
  return seed.annualWeeks.reduce(
    (total, week) => total + (getPhaseWeek(seed, week)?.workouts.length ?? 0),
    0,
  );
}

function countAnnualExercises(seed) {
  return seed.annualWeeks.reduce(
    (total, week) =>
      total +
      (getPhaseWeek(seed, week)?.workouts.reduce(
        (sum, workout) => sum + workout.exercises.length,
        0,
      ) ?? 0),
    0,
  );
}

function countAnnualPrescriptions(seed) {
  return seed.annualWeeks.reduce(
    (total, week) =>
      total +
      (getPhaseWeek(seed, week)?.workouts.reduce(
        (workoutTotal, workout) =>
          workoutTotal +
          workout.exercises.reduce(
            (exerciseTotal, exercise) => exerciseTotal + exercise.prescriptions.length,
            0,
          ),
        0,
      ) ?? 0),
    0,
  );
}

function getPhaseWeek(seed, week) {
  if (!week.phaseCode || !week.phaseWeekNumber) return null;
  return seed.phaseWeeks[week.phaseCode].find(
    (candidate) => candidate.weekNumber === week.phaseWeekNumber,
  );
}
