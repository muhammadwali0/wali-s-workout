import type { OneRmRecord } from '../load/oneRmVault.ts';
import type { PlannedSet } from '../workout/sessionPlanner.ts';

export type TestWeekAssistant = {
  isTestWorkout: boolean;
  primaryExercises: string[];
  missingBaselineExercises: string[];
  testedRecords: number;
};

export function getTestWeekAssistant(
  workoutType: string,
  plannedSets: readonly PlannedSet[],
  records: readonly OneRmRecord[],
): TestWeekAssistant {
  const primarySets = plannedSets.filter((set) => set.exerciseRole === 'primary');
  const primaryByExercise = new Map(
    primarySets.map((set) => [set.exerciseId, set.exerciseName]),
  );
  const recordByExercise = new Set(records.map((record) => record.exerciseId));

  return {
    isTestWorkout: workoutType === 'test',
    primaryExercises: [...primaryByExercise.values()],
    missingBaselineExercises: [...primaryByExercise]
      .filter(([exerciseId]) => !recordByExercise.has(exerciseId))
      .map(([, exerciseName]) => exerciseName),
    testedRecords: records.filter((record) => record.recordType === 'tested').length,
  };
}
