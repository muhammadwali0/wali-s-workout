export type BlockComparisonSet = {
  blockNumber: number | null;
  phaseCode: string | null;
  setType: string;
  completed: boolean;
  weight: number | null;
  reps: number | null;
};

export type BlockComparison = {
  blockNumber: number;
  phaseCode: string;
  totalVolume: number;
  workingSets: number;
};

export type PhaseComparison = {
  phaseCode: string;
  totalVolume: number;
  workingSets: number;
};

export function compareBlocks(
  sets: readonly BlockComparisonSet[],
): BlockComparison[] {
  const byBlock = new Map<number, BlockComparison>();

  for (const set of sets) {
    if (!set.completed || set.setType === 'warmup' || set.blockNumber === null) {
      continue;
    }

    const current = byBlock.get(set.blockNumber) ?? {
      blockNumber: set.blockNumber,
      phaseCode: set.phaseCode ?? 'Unknown',
      totalVolume: 0,
      workingSets: 0,
    };

    current.totalVolume += (set.weight ?? 0) * (set.reps ?? 0);
    current.workingSets += 1;
    byBlock.set(set.blockNumber, current);
  }

  return [...byBlock.values()].sort((a, b) => a.blockNumber - b.blockNumber);
}

export function comparePhases(
  sets: readonly BlockComparisonSet[],
): PhaseComparison[] {
  const byPhase = new Map<string, PhaseComparison>();

  for (const set of sets) {
    if (!set.completed || set.setType === 'warmup' || !set.phaseCode) {
      continue;
    }

    const current = byPhase.get(set.phaseCode) ?? {
      phaseCode: set.phaseCode,
      totalVolume: 0,
      workingSets: 0,
    };

    current.totalVolume += (set.weight ?? 0) * (set.reps ?? 0);
    current.workingSets += 1;
    byPhase.set(set.phaseCode, current);
  }

  return [...byPhase.values()].sort((a, b) =>
    a.phaseCode.localeCompare(b.phaseCode),
  );
}
