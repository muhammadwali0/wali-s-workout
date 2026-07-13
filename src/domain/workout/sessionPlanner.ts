import type { SeedWorkout } from '../program/seedResolver';

export type PlannedSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseRole: string;
  originalExerciseId: string;
  originalExerciseName: string;
  substitutionScope: string | null;
  exerciseOrder: number;
  supersetGroup: string | null;
  setNumber: number;
  setType: string;
  targetReps: string | null;
  percent1RmLow: number | null;
  percent1RmHigh: number | null;
  targetRpeLow: number | null;
  targetRpeHigh: number | null;
  restSecondsMin: number | null;
  restSecondsMax: number | null;
  tempo: string | null;
  notes: string | null;
};

export type PlannedExerciseReplacement = {
  originalExerciseId: string;
  replacementExerciseId: string;
  replacementName: string;
  scope: string;
};

export function createPlannedSets(workout: SeedWorkout): PlannedSet[] {
  return workout.exercises.flatMap((exercise) => {
    let setNumber = 0;

    return exercise.prescriptions.flatMap((prescription) =>
      Array.from({ length: prescription.targetSets }, (_, index) => {
        setNumber += 1;

        return {
          id: `${prescription.id}_${index + 1}`,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          exerciseRole: exercise.role,
          originalExerciseId: exercise.exerciseId,
          originalExerciseName: exercise.name,
          substitutionScope: null,
          exerciseOrder: exercise.sortOrder,
          supersetGroup: exercise.supersetGroup,
          setNumber,
          setType: prescription.setType,
          targetReps: formatTargetReps(
            prescription.targetRepsText,
            prescription.targetRepsMin,
            prescription.targetRepsMax,
          ),
          percent1RmLow: prescription.percent1RmLow,
          percent1RmHigh: prescription.percent1RmHigh,
          targetRpeLow: prescription.targetRpeLow,
          targetRpeHigh: prescription.targetRpeHigh,
          restSecondsMin: prescription.restSecondsMin,
          restSecondsMax: prescription.restSecondsMax,
          tempo: prescription.tempo,
          notes: prescription.notes ?? exercise.notes ?? null,
        };
      }),
    );
  });
}

export function applyExerciseReplacements(
  plannedSets: readonly PlannedSet[],
  replacements: readonly PlannedExerciseReplacement[],
): PlannedSet[] {
  const replacementByExercise = new Map(
    replacements.map((replacement) => [
      replacement.originalExerciseId,
      replacement,
    ]),
  );

  return plannedSets.map((set) => {
    const replacement = replacementByExercise.get(set.originalExerciseId);
    if (!replacement) return set;

    return {
      ...set,
      exerciseId: replacement.replacementExerciseId,
      exerciseName: replacement.replacementName,
      substitutionScope: replacement.scope,
    };
  });
}

function formatTargetReps(
  text: string | null,
  minimum: number | null,
  maximum: number | null,
) {
  if (text) return text;
  if (minimum === null && maximum === null) return null;
  if (minimum === maximum) return String(minimum);
  if (minimum === null) return String(maximum);
  if (maximum === null) return String(minimum);
  return `${minimum}-${maximum}`;
}
