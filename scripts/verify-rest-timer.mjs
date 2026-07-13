import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const { createRestTimer, getRestTimerState } = await import(
  '../src/domain/workout/restTimer.ts'
);

const year = createTrainingYear('2026-01-01');
const due = getDueWorkout(getProgramPosition('2026-01-01', year));
assert.equal(due.status, 'workout_due');

const plannedSets = createPlannedSets(due.workout);
assert.equal(createRestTimer(plannedSets[0], 0), null);

const workingSet = plannedSets.find((set) => set.restSecondsMax === 240);
const timer = createRestTimer(workingSet, 1000);
assert.deepEqual(timer, {
  plannedSetId: workingSet.id,
  startedAtMs: 1000,
  durationSeconds: 240,
});
assert.deepEqual(getRestTimerState(timer, 31_000), {
  elapsedSeconds: 30,
  remainingSeconds: 210,
  isComplete: false,
});
assert.deepEqual(getRestTimerState(timer, 241_000), {
  elapsedSeconds: 240,
  remainingSeconds: 0,
  isComplete: true,
});

console.log('rest timer verified');
