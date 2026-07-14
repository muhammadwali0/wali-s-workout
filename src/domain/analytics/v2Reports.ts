import type { BlockComparison } from './blockComparison.ts';
import type { FatigueSignals } from './fatigueSignals.ts';
import type { MuscleExposure } from './muscleExposure.ts';

export type MuscleExposureGap = {
  muscleId: string;
  plannedHardSets: number;
  actualHardSets: number;
  hardSetDelta: number;
};

export function comparePlannedActualMuscleExposure(
  planned: readonly MuscleExposure[],
  actual: readonly MuscleExposure[],
): MuscleExposureGap[] {
  const muscleIds = new Set([
    ...planned.map((exposure) => exposure.muscleId),
    ...actual.map((exposure) => exposure.muscleId),
  ]);
  const plannedByMuscle = new Map(planned.map((exposure) => [exposure.muscleId, exposure]));
  const actualByMuscle = new Map(actual.map((exposure) => [exposure.muscleId, exposure]));

  return [...muscleIds]
    .map((muscleId) => {
      const plannedHardSets = plannedByMuscle.get(muscleId)?.hardSets ?? 0;
      const actualHardSets = actualByMuscle.get(muscleId)?.hardSets ?? 0;
      return {
        muscleId,
        plannedHardSets,
        actualHardSets,
        hardSetDelta: actualHardSets - plannedHardSets,
      };
    })
    .sort((a, b) => Math.abs(b.hardSetDelta) - Math.abs(a.hardSetDelta));
}

export function getBlockReport(blocks: readonly BlockComparison[]) {
  const topVolume = [...blocks].sort((a, b) => b.totalVolume - a.totalVolume)[0] ?? null;
  const topSets = [...blocks].sort((a, b) => b.workingSets - a.workingSets)[0] ?? null;
  const totalVolume = blocks.reduce((sum, block) => sum + block.totalVolume, 0);
  const totalSets = blocks.reduce((sum, block) => sum + block.workingSets, 0);

  return {
    topVolume,
    topSets,
    averageVolume: blocks.length === 0 ? 0 : totalVolume / blocks.length,
    averageWorkingSets: blocks.length === 0 ? 0 : totalSets / blocks.length,
  };
}

export function getFatigueReasons(signals: FatigueSignals) {
  return [
    signals.failedSets > 0 ? `${signals.failedSets} failed sets` : null,
    signals.highRpeSets > 0 ? `${signals.highRpeSets} high-RPE sets` : null,
    signals.lowRirSets > 0 ? `${signals.lowRirSets} low-RIR sets` : null,
    signals.missedSessions > 0 ? `${signals.missedSessions} missed sessions` : null,
    signals.performanceDropSignals > 0 ? 'week-to-week volume drop' : null,
  ].filter((reason): reason is string => reason !== null);
}
