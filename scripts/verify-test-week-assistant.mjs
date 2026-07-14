import assert from 'node:assert/strict';

const { getTestWeekAssistant } = await import(
  '../src/domain/program/testWeekAssistant.ts'
);

const assistant = getTestWeekAssistant(
  'test',
  [
    {
      id: 'set_1',
      exerciseId: 'squat',
      exerciseName: 'Squat',
      exerciseRole: 'primary',
      originalExerciseId: 'squat',
      originalExerciseName: 'Squat',
      substitutionScope: null,
      exerciseOrder: 1,
      supersetGroup: null,
      setNumber: 1,
      setType: 'working',
      targetReps: '1',
      percent1RmLow: null,
      percent1RmHigh: null,
      targetRpeLow: null,
      targetRpeHigh: null,
      restSecondsMin: null,
      restSecondsMax: null,
      tempo: null,
      notes: null,
    },
    {
      id: 'set_2',
      exerciseId: 'bench',
      exerciseName: 'Bench',
      exerciseRole: 'primary',
      originalExerciseId: 'bench',
      originalExerciseName: 'Bench',
      substitutionScope: null,
      exerciseOrder: 2,
      supersetGroup: null,
      setNumber: 1,
      setType: 'working',
      targetReps: '1',
      percent1RmLow: null,
      percent1RmHigh: null,
      targetRpeLow: null,
      targetRpeHigh: null,
      restSecondsMin: null,
      restSecondsMax: null,
      tempo: null,
      notes: null,
    },
    {
      id: 'set_3',
      exerciseId: 'row',
      exerciseName: 'Row',
      exerciseRole: 'secondary',
      originalExerciseId: 'row',
      originalExerciseName: 'Row',
      substitutionScope: null,
      exerciseOrder: 3,
      supersetGroup: null,
      setNumber: 1,
      setType: 'working',
      targetReps: '8',
      percent1RmLow: null,
      percent1RmHigh: null,
      targetRpeLow: null,
      targetRpeHigh: null,
      restSecondsMin: null,
      restSecondsMax: null,
      tempo: null,
      notes: null,
    },
  ],
  [
    {
      id: 'squat_tested_now',
      exerciseId: 'squat',
      value: 180,
      unit: 'kg',
      recordType: 'tested',
      programBlockId: null,
      recordedAt: '2026-01-01T00:00:00Z',
    },
  ],
);

assert.equal(assistant.isTestWorkout, true);
assert.deepEqual(assistant.primaryExercises, ['Squat', 'Bench']);
assert.deepEqual(assistant.missingBaselineExercises, ['Bench']);
assert.equal(assistant.testedRecords, 1);
assert.equal(getTestWeekAssistant('training', [], []).isTestWorkout, false);

console.log('test week assistant verified');
