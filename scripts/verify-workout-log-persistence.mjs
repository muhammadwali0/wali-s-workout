import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const { completeSet, createWorkoutDraft } = await import(
  '../src/domain/workout/workoutLog.ts'
);
const { buildWorkoutLogRows } = await import(
  '../src/db/workoutLogPersistence.ts'
);

const year = createTrainingYear('2026-01-01');
const due = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(due.status, 'workout_due');

const plannedSets = createPlannedSets(due.workout);
const draft = completeSet(createWorkoutDraft(due.workout.id, plannedSets), plannedSets[0].id, {
  weight: 20,
  reps: 5,
  rpe: 6,
});
const rows = buildWorkoutLogRows(draft, {
  workoutLogId: 'log_1',
  workoutInstanceId: 'instance_1',
  recordedAt: '2026-01-01T10:00:00Z',
  unit: 'kg',
});

assert.equal(rows.workoutLog.id, 'log_1');
assert.equal(rows.workoutLog.status, 'draft');
assert.equal(rows.workoutLog.total_volume, 100);
assert.equal(rows.workoutLog.total_working_sets, 0);
assert.equal(rows.exerciseLogs.length, due.workout.exercises.length);
assert.equal(rows.setLogs.length, plannedSets.length);
assert.deepEqual(rows.setLogs[0], {
  id: `log_1_set_${plannedSets[0].id}`,
  exercise_log_id: 'log_1_exercise_1',
  program_set_prescription_id: null,
  set_order: 1,
  set_type: 'warmup',
  weight: 20,
  unit: 'kg',
  reps: 5,
  rpe: 6,
  rir: null,
  duration_seconds: null,
  is_completed: 1,
  is_pr: 0,
  is_warmup: 1,
  is_failed: 0,
  user_notes: null,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
});

console.log('workout log persistence verified');
