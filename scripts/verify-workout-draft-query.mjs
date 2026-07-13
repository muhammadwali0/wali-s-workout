import assert from 'node:assert/strict';

const { getSavedWorkoutDraft } = await import('../src/db/workoutDraftQuery.ts');

const plannedSets = [
  {
    id: 'set_1',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    originalExerciseId: 'back_squat',
    originalExerciseName: 'Back Squat',
    substitutionScope: null,
    exerciseOrder: 1,
    setNumber: 1,
    setType: 'working',
    targetReps: '5',
    percent1RmLow: null,
    percent1RmHigh: null,
    targetRpeLow: null,
    targetRpeHigh: null,
    restSecondsMin: 120,
    restSecondsMax: 180,
  },
  {
    id: 'set_2',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    originalExerciseId: 'back_squat',
    originalExerciseName: 'Back Squat',
    substitutionScope: null,
    exerciseOrder: 1,
    setNumber: 2,
    setType: 'working',
    targetReps: '5',
    percent1RmLow: null,
    percent1RmHigh: null,
    targetRpeLow: null,
    targetRpeHigh: null,
    restSecondsMin: 120,
    restSecondsMax: 180,
  },
];
const calls = [];
const db = {
  async getFirstAsync(sql, instanceId) {
    calls.push({ sql, instanceId });
    return { workoutLogId: 'log_1', status: 'draft' };
  },
  async getAllAsync(sql, workoutLogId) {
    calls.push({ sql, workoutLogId });
    return [
      {
        exerciseOrder: 1,
        setOrder: 1,
        completed: 1,
        weight: 100,
        reps: 5,
        rpe: 7,
        notes: null,
      },
      {
        exerciseOrder: 1,
        setOrder: 2,
        completed: 0,
        weight: null,
        reps: null,
        rpe: null,
        notes: 'Skipped set',
      },
    ];
  },
};

const draft = await getSavedWorkoutDraft(db, 'instance_1', 'workout_1', plannedSets);
assert.equal(draft.status, 'draft');
assert.equal(draft.actualSets[0].completed, true);
assert.equal(draft.actualSets[0].skipped, false);
assert.equal(draft.actualSets[0].weight, 100);
assert.equal(draft.actualSets[1].completed, false);
assert.equal(draft.actualSets[1].skipped, true);
assert.match(calls[0].sql, /FROM workout_logs/);
assert.match(calls[1].sql, /FROM set_logs/);

console.log('workout draft query verified');
