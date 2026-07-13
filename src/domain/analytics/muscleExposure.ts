import { programSeed } from '../../data/programSeed.ts';

export type MuscleExposureSet = {
  exerciseId: string;
  setType: string;
  completed: boolean;
  weight: number | null;
  reps: number | null;
};

export type MuscleExposure = {
  muscleId: string;
  hardSets: number;
  volumeLoad: number;
};

const exerciseById: Map<string, (typeof programSeed.exercises)[number]> = new Map(
  programSeed.exercises.map((exercise) => [exercise.id, exercise]),
);

export function calculateMuscleExposure(
  sets: readonly MuscleExposureSet[],
): MuscleExposure[] {
  const exposure = new Map<string, MuscleExposure>();

  for (const set of sets) {
    if (!set.completed || set.setType === 'warmup') continue;

    const exercise = exerciseById.get(set.exerciseId);
    if (!exercise) continue;

    const setVolume = (set.weight ?? 0) * (set.reps ?? 0);

    for (const muscle of exercise.muscles) {
      const current = exposure.get(muscle.muscleId) ?? {
        muscleId: muscle.muscleId,
        hardSets: 0,
        volumeLoad: 0,
      };

      current.hardSets += muscle.heatmapWeight;
      current.volumeLoad += setVolume * muscle.heatmapWeight;
      exposure.set(muscle.muscleId, current);
    }
  }

  return [...exposure.values()].sort((a, b) => a.muscleId.localeCompare(b.muscleId));
}
