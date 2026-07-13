import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const {
  addSetAfter,
  completeSet,
  completeWorkout,
  createWorkoutDraft,
  discardWorkout,
  removeExercise,
  removeSet,
  skipSet,
  summarizeWorkoutDraft,
} = await import('../src/domain/workout/workoutLog.ts');

const year = createTrainingYear('2026-01-01');
const due = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(due.status, 'workout_due');

const plannedSets = createPlannedSets(due.workout);
const draft = createWorkoutDraft(
  due.workout.id,
  plannedSets,
  '2026-01-01T10:00:00Z',
);
assert.equal(draft.startedAt, '2026-01-01T10:00:00Z');
assert.equal(draft.actualSets.length, plannedSets.length);
assert.equal(summarizeWorkoutDraft(draft).completedSets, 0);
assert.equal(draft.actualSets[0].skipped, false);
assert.equal(discardWorkout(draft).status, 'discarded');

const logged = completeSet(draft, plannedSets[0].id, {
  weight: 20,
  reps: 5,
  rpe: 6,
  rir: 4,
  failed: true,
  notes: 'Felt stable',
});
assert.equal(draft.actualSets[0].completed, false);
assert.equal(logged.actualSets[0].completed, true);
assert.equal(logged.actualSets[0].skipped, false);
assert.equal(logged.actualSets[0].failed, true);
assert.equal(logged.actualSets[0].rir, 4);
assert.equal(logged.actualSets[0].notes, 'Felt stable');
assert.deepEqual(summarizeWorkoutDraft(logged), {
  plannedSets: 23,
  completedSets: 1,
  totalVolume: 100,
  averageRpe: 6,
  isComplete: false,
});

assert.throws(() => completeSet(logged, 'missing', { weight: 1, reps: 1 }), /Unknown/);
assert.throws(() => completeSet(logged, plannedSets[1].id, { weight: 1, reps: 0 }), /reps/);
assert.throws(() => completeSet(logged, plannedSets[1].id, { weight: 1, reps: 1, rir: -1 }), /rir/);
assert.throws(() => completeWorkout(logged), /unfinished/);

const skipped = skipSet(logged, plannedSets[1].id);
assert.equal(skipped.actualSets[1].completed, false);
assert.equal(skipped.actualSets[1].skipped, true);
assert.equal(summarizeWorkoutDraft(skipped).completedSets, 1);
assert.throws(() => skipSet(skipped, 'missing'), /Unknown/);

const withAddedSet = addSetAfter(draft, plannedSets[0].id);
assert.equal(withAddedSet.plannedSets.length, plannedSets.length + 1);
assert.equal(withAddedSet.actualSets[1].plannedSetId, withAddedSet.plannedSets[1].id);
assert.equal(withAddedSet.plannedSets[1].setType, 'added');
assert.equal(removeSet(withAddedSet, withAddedSet.plannedSets[1].id).plannedSets.length, plannedSets.length);
assert.throws(() => addSetAfter(draft, 'missing'), /Unknown/);
assert.throws(() => removeSet(logged, plannedSets[0].id), /completed or skipped/);
assert.throws(() => removeSet(createWorkoutDraft('single', [plannedSets[0]]), plannedSets[0].id), /final set/);
assert.throws(
  () => completeWorkout({ ...draft, plannedSets: [], actualSets: [] }),
  /no sets/,
);

const firstExerciseSetCount = plannedSets.filter(
  (set) => set.exerciseOrder === plannedSets[0].exerciseOrder,
).length;
const exerciseRemoved = removeExercise(draft, plannedSets[0].id);
assert.equal(exerciseRemoved.plannedSets.length, plannedSets.length - firstExerciseSetCount);
assert.equal(
  exerciseRemoved.actualSets.some((set) => set.plannedSetId === plannedSets[0].id),
  false,
);
assert.throws(() => removeExercise(draft, 'missing'), /Unknown/);
assert.throws(
  () => removeExercise(createWorkoutDraft('single_exercise', [plannedSets[0]]), plannedSets[0].id),
  /final exercise/,
);
assert.throws(() => removeExercise(logged, plannedSets[0].id), /completed or skipped/);

const completeDraft = plannedSets.reduce(
  (current, set) => completeSet(current, set.id, { weight: 10, reps: 1 }),
  draft,
);
assert.equal(completeWorkout(completeDraft).status, 'completed');

const completeWithSkipped = plannedSets
  .slice(1)
  .reduce(
    (current, set) => completeSet(current, set.id, { weight: 10, reps: 1 }),
    skipSet(draft, plannedSets[0].id),
  );
assert.equal(completeWorkout(completeWithSkipped).status, 'completed');

console.log('workout log verified');
