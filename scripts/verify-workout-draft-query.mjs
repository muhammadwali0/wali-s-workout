import assert from 'node:assert/strict';

const { getSavedWorkoutDraft } = await import('../src/db/workoutDraftQuery.ts');

const plannedSets = [
  {
    id: 'set_1',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    exerciseRole: 'primary',
    originalExerciseId: 'back_squat',
    originalExerciseName: 'Back Squat',
    substitutionScope: null,
    exerciseOrder: 1,
    supersetGroup: null,
    setNumber: 1,
    setType: 'working',
    targetReps: '5',
    percent1RmLow: null,
    percent1RmHigh: null,
    targetRpeLow: null,
    targetRpeHigh: null,
    restSecondsMin: 120,
    restSecondsMax: 180,
    tempo: null,
    notes: null,
  },
  {
    id: 'set_2',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    exerciseRole: 'primary',
    originalExerciseId: 'back_squat',
    originalExerciseName: 'Back Squat',
    substitutionScope: null,
    exerciseOrder: 1,
    supersetGroup: null,
    setNumber: 2,
    setType: 'working',
    targetReps: '5',
    percent1RmLow: null,
    percent1RmHigh: null,
    targetRpeLow: null,
    targetRpeHigh: null,
    restSecondsMin: 120,
    restSecondsMax: 180,
    tempo: null,
    notes: null,
  },
];
const calls = [];
const db = {
  async getFirstAsync(sql, instanceId) {
    calls.push({ sql, instanceId });
    return {
      workoutLogId: 'log_1',
      status: 'draft',
      startedAt: '2026-01-01T09:55:00Z',
    };
  },
  async getAllAsync(sql, workoutLogId) {
    calls.push({ sql, workoutLogId });
    return [
      {
        exerciseOrder: 1,
        setOrder: 1,
        setType: 'working',
        completed: 1,
        failed: 1,
        weight: 100,
        reps: 5,
        rpe: 7,
        rir: 3,
        notes: null,
      },
      {
        exerciseOrder: 1,
        setOrder: 2,
        setType: 'working',
        completed: 0,
        failed: 0,
        weight: null,
        reps: null,
        rpe: null,
        rir: null,
        notes: 'Skipped set',
      },
      {
        exerciseOrder: 1,
        setOrder: 3,
        setType: 'added',
        completed: 1,
        failed: 0,
        weight: 90,
        reps: 8,
        rpe: 8,
        rir: 2,
        notes: 'Back-off',
      },
    ];
  },
};

const draft = await getSavedWorkoutDraft(db, 'instance_1', 'workout_1', plannedSets);
assert.equal(draft.status, 'draft');
assert.equal(draft.startedAt, '2026-01-01T09:55:00Z');
assert.equal(draft.plannedSets.length, 3);
assert.equal(draft.actualSets[0].completed, true);
assert.equal(draft.actualSets[0].skipped, false);
assert.equal(draft.actualSets[0].failed, true);
assert.equal(draft.actualSets[0].weight, 100);
assert.equal(draft.actualSets[0].rir, 3);
assert.equal(draft.actualSets[1].completed, false);
assert.equal(draft.actualSets[1].skipped, true);
assert.equal(draft.plannedSets[2].setType, 'added');
assert.equal(draft.actualSets[2].completed, true);
assert.equal(draft.actualSets[2].notes, 'Back-off');
assert.equal(draft.actualSets[2].rir, 2);
assert.match(calls[0].sql, /FROM workout_logs/);
assert.match(calls[1].sql, /FROM set_logs/);
assert.match(calls[1].sql, /sl\.set_type AS setType/);
assert.match(calls[1].sql, /sl\.is_failed AS failed/);
assert.match(calls[1].sql, /sl\.rir/);

console.log('workout draft query verified');
