import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const { applyExerciseReplacements } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const { completeSet, completeWorkout, createWorkoutDraft, skipSet } = await import(
  '../src/domain/workout/workoutLog.ts'
);
const { buildWorkoutLogRows, saveWorkoutDraft } = await import(
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
assert.equal(rows.exerciseLogs[0].exercise_id, 'back_squat');
assert.equal(rows.exerciseLogs[0].original_exercise_id, 'back_squat');
assert.equal(rows.exerciseLogs[0].was_substituted, 0);
assert.equal(rows.exerciseLogs[0].status, 'pending');
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

const substitutedRows = buildWorkoutLogRows(
  createWorkoutDraft(
    due.workout.id,
    applyExerciseReplacements(plannedSets, [
      {
        originalExerciseId: 'back_squat',
        replacementExerciseId: 'front_squat',
        replacementName: 'Front Squat',
        scope: 'today_only',
      },
    ]),
  ),
  {
    workoutLogId: 'log_sub',
    workoutInstanceId: 'instance_1',
    recordedAt: '2026-01-01T10:00:00Z',
    unit: 'kg',
  },
);
assert.equal(substitutedRows.exerciseLogs[0].exercise_id, 'front_squat');
assert.equal(substitutedRows.exerciseLogs[0].original_exercise_id, 'back_squat');
assert.equal(substitutedRows.exerciseLogs[0].was_substituted, 1);
assert.equal(substitutedRows.exerciseLogs[0].substitution_reason, 'today_only');

const skippedRows = buildWorkoutLogRows(
  plannedSets
    .filter((set) => set.exerciseOrder === 1)
    .reduce(
      (current, set) => skipSet(current, set.id),
      createWorkoutDraft(due.workout.id, plannedSets),
    ),
  {
    workoutLogId: 'log_skip',
    workoutInstanceId: 'instance_1',
    recordedAt: '2026-01-01T10:00:00Z',
    unit: 'kg',
  },
);
assert.equal(skippedRows.setLogs[0].is_completed, 0);
assert.equal(skippedRows.setLogs[0].user_notes, 'Skipped set');
assert.equal(skippedRows.exerciseLogs[0].status, 'skipped');

const calls = [];
const db = {
  async execAsync(sql) {
    calls.push({ type: 'exec', sql });
  },
  async getAllAsync(sql, ...params) {
    calls.push({ type: 'all', sql, params });
    return [{ weight: 10, reps: 1 }];
  },
  async runAsync(sql, ...params) {
    calls.push({ type: 'run', sql, params });
  },
};

await saveWorkoutDraft(db, draft, {
  workoutLogId: 'log_1',
  workoutInstanceId: 'instance_1',
  recordedAt: '2026-01-01T10:00:00Z',
  unit: 'kg',
});
const inProgressUpdate = calls.find((call) =>
  call.sql?.startsWith('UPDATE workout_instances'),
);
assert.deepEqual(inProgressUpdate?.params, [
  'in_progress',
  null,
  '2026-01-01T10:00:00Z',
  'instance_1',
]);
const prInsert = calls.find((call) =>
  call.sql?.includes('INSERT OR REPLACE INTO personal_records'),
);
assert.equal(Boolean(prInsert), true);
assert.equal(
  calls.find((call) => call.sql?.includes('INSERT OR REPLACE INTO set_logs'))?.params[12],
  1,
);

calls.length = 0;
const completeDraft = completeWorkout(
  plannedSets.reduce(
    (current, set) => completeSet(current, set.id, { weight: 10, reps: 1 }),
    createWorkoutDraft(due.workout.id, plannedSets),
  ),
);
assert.equal(
  buildWorkoutLogRows(completeDraft, {
    workoutLogId: 'log_complete_rows',
    workoutInstanceId: 'instance_rows',
    recordedAt: '2026-01-02T10:00:00Z',
    unit: 'kg',
  }).exerciseLogs[0].status,
  'completed',
);
await saveWorkoutDraft(db, completeDraft, {
  workoutLogId: 'log_2',
  workoutInstanceId: 'instance_2',
  recordedAt: '2026-01-02T10:00:00Z',
  unit: 'kg',
});
const completeUpdate = calls.find((call) =>
  call.sql?.startsWith('UPDATE workout_instances'),
);
assert.deepEqual(completeUpdate?.params, [
  'completed',
  '2026-01-02',
  '2026-01-02T10:00:00Z',
  'instance_2',
]);

console.log('workout log persistence verified');
