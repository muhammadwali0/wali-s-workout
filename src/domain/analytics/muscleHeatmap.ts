import { programSeed } from '../../data/programSeed.ts';
import type { MuscleExposure } from './muscleExposure.ts';

export type MuscleHeatmapRegion = {
  muscleId: string;
  name: string;
  view: 'front' | 'back';
  hardSets: number;
  volumeLoad: number;
  intensity: number;
};

const muscleById = new Map<string, (typeof programSeed.muscles)[number]>(
  programSeed.muscles.map((muscle) => [muscle.id, muscle]),
);

function heatmapViews(
  view: (typeof programSeed.muscles)[number]['heatmapView'],
): readonly ('front' | 'back')[] {
  if (view === 'front') return ['front'];
  if (view === 'back') return ['back'];
  return ['front', 'back'];
}

export function calculateMuscleHeatmap(
  exposure: readonly MuscleExposure[],
): MuscleHeatmapRegion[] {
  const maxVolume = Math.max(...exposure.map((item) => item.volumeLoad), 1);

  return exposure.flatMap((item) => {
    const muscle = muscleById.get(item.muscleId);
    if (!muscle) return [];

    return heatmapViews(muscle.heatmapView).map((view) => ({
      muscleId: item.muscleId,
      name: muscle.name,
      view,
      hardSets: item.hardSets,
      volumeLoad: item.volumeLoad,
      intensity: item.volumeLoad / maxVolume,
    }));
  });
}
