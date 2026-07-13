export type OneRmRecordType =
  | 'starting'
  | 'current_working'
  | 'tested'
  | 'estimated'
  | 'block_baseline'
  | 'phase_end';

export type OneRmRecord = {
  id: string;
  exerciseId: string;
  value: number;
  unit: 'kg' | 'lb';
  recordType: OneRmRecordType;
  programBlockId: string | null;
  recordedAt: string;
};

export function getCurrentOneRm(
  records: readonly OneRmRecord[],
  exerciseId: string,
): OneRmRecord | null {
  return records
    .filter((record) => record.exerciseId === exerciseId)
    .filter((record) =>
      ['current_working', 'tested', 'block_baseline', 'phase_end'].includes(
        record.recordType,
      ),
    )
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null;
}

export function createOneRmRecord(input: Omit<OneRmRecord, 'id'>): OneRmRecord {
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error('1RM value must be positive');
  }

  return {
    ...input,
    id: `${input.exerciseId}_${input.recordType}_${input.recordedAt}`,
  };
}

export function transferPhaseEndToBlockBaseline(
  phaseEndRecord: OneRmRecord,
  nextBlockId: string,
  recordedAt: string,
): OneRmRecord {
  if (phaseEndRecord.recordType !== 'phase_end' && phaseEndRecord.recordType !== 'tested') {
    throw new Error('Only tested or phase-end records can become a new block baseline');
  }

  return createOneRmRecord({
    exerciseId: phaseEndRecord.exerciseId,
    value: phaseEndRecord.value,
    unit: phaseEndRecord.unit,
    recordType: 'block_baseline',
    programBlockId: nextBlockId,
    recordedAt,
  });
}
