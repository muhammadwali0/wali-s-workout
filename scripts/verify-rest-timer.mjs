import assert from 'node:assert/strict';

const { createTrainingYear, getProgramPosition } = await import(
  '../src/domain/program/yearEngine.ts'
);
const { getDueWorkout } = await import('../src/domain/program/seedResolver.ts');
const { createPlannedSets } = await import(
  '../src/domain/workout/sessionPlanner.ts'
);
const { addRestTime, createRestTimer, getRestTimerState, pauseRestTimer, resumeRestTimer } = await import(
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
  pausedAtMs: null,
});
assert.deepEqual(getRestTimerState(timer, 31_000), {
  elapsedSeconds: 30,
  remainingSeconds: 210,
  isComplete: false,
  isPaused: false,
});
assert.deepEqual(getRestTimerState(timer, 241_000), {
  elapsedSeconds: 240,
  remainingSeconds: 0,
  isComplete: true,
  isPaused: false,
});

const extended = addRestTime(timer, 30);
assert.equal(extended.durationSeconds, 270);
assert.throws(() => addRestTime(timer, 0), /positive/);

const paused = pauseRestTimer(timer, 31_000);
assert.equal(paused.pausedAtMs, 31_000);
assert.deepEqual(getRestTimerState(paused, 91_000), {
  elapsedSeconds: 30,
  remainingSeconds: 210,
  isComplete: false,
  isPaused: true,
});

const resumed = resumeRestTimer(paused, 91_000);
assert.equal(resumed.pausedAtMs, null);
assert.equal(resumed.startedAtMs, 61_000);
assert.equal(getRestTimerState(resumed, 121_000).elapsedSeconds, 60);

console.log('rest timer verified');
