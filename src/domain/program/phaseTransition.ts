import type { OneRmRecord } from '../load/oneRmVault.ts';
import type { ProgramPosition } from './yearEngine.ts';

export type PhaseTransitionSummary = {
  sourceBlockNumber: number;
  nextBlockNumber: number;
  nextBlockId: string;
  phaseCode: string;
  baselineCount: number;
  testedCount: number;
  phaseEndCount: number;
};

export function getPhaseTransitionSummary(
  position: ProgramPosition,
  records: readonly OneRmRecord[],
): PhaseTransitionSummary | null {
  if (position.status !== 'in_year') return null;
  if (!position.week.isBuffer || position.week.blockNumber !== 3) return null;

  return {
    sourceBlockNumber: 3,
    nextBlockNumber: 4,
    nextBlockId: 'block_4',
    phaseCode: 'phase2',
    baselineCount: records.length,
    testedCount: records.filter((record) => record.recordType === 'tested').length,
    phaseEndCount: records.filter((record) => record.recordType === 'phase_end').length,
  };
}
