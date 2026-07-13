import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const {
  completeSet,
  completeWorkout,
  createWorkoutDraft,
  summarizeWorkoutDraft,
} = await import('../src/domain/workout/workoutLog.ts');

const year = createTrainingYear('2026-01-01');
const due = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(due.status, 'workout_due');

const plannedSets = createPlannedSets(due.workout);
const draft = createWorkoutDraft(due.workout.id, plannedSets);
assert.equal(draft.actualSets.length, plannedSets.length);
assert.equal(summarizeWorkoutDraft(draft).completedSets, 0);

const logged = completeSet(draft, plannedSets[0].id, {
  weight: 20,
  reps: 5,
  rpe: 6,
});
assert.equal(draft.actualSets[0].completed, false);
assert.equal(logged.actualSets[0].completed, true);
assert.deepEqual(summarizeWorkoutDraft(logged), {
  plannedSets: 23,
  completedSets: 1,
  totalVolume: 100,
  averageRpe: 6,
  isComplete: false,
});

assert.throws(() => completeSet(logged, 'missing', { weight: 1, reps: 1 }), /Unknown/);
assert.throws(() => completeSet(logged, plannedSets[1].id, { weight: 1, reps: 0 }), /reps/);
assert.throws(() => completeWorkout(logged), /unfinished/);

const completeDraft = plannedSets.reduce(
  (current, set) => completeSet(current, set.id, { weight: 10, reps: 1 }),
  draft,
);
assert.equal(completeWorkout(completeDraft).status, 'completed');

console.log('workout log verified');
