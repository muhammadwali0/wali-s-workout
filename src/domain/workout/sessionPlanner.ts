import type { SeedWorkout } from '../program/seedResolver';

export type PlannedSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  setType: string;
  targetReps: string | null;
  percent1RmLow: number | null;
  percent1RmHigh: number | null;
  targetRpeLow: number | null;
  targetRpeHigh: number | null;
  restSecondsMin: number | null;
  restSecondsMax: number | null;
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
          exerciseOrder: exercise.sortOrder,
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
        };
      }),
    );
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
