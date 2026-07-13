import {
  createOneRmRecord,
  type OneRmRecord,
  type OneRmRecordType,
} from '../domain/load/oneRmVault.ts';
import type { TrainingDatabase } from './database.ts';

export type CurrentOneRmRecord = OneRmRecord & {
  exerciseName: string;
};

export async function getCurrentOneRmRecords(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<CurrentOneRmRecord[]> {
  return db.getAllAsync<CurrentOneRmRecord>(
    `SELECT
       r.id,
       r.exercise_id AS exerciseId,
       e.name AS exerciseName,
       r.value,
       r.unit,
       r.record_type AS recordType,
       r.program_block_id AS programBlockId,
       r.recorded_at AS recordedAt
     FROM one_rm_records r
     JOIN exercises e ON e.id = r.exercise_id
     WHERE r.record_type IN ('current_working', 'tested', 'block_baseline', 'phase_end')
       AND NOT EXISTS (
         SELECT 1
         FROM one_rm_records newer
         WHERE newer.exercise_id = r.exercise_id
           AND newer.record_type IN ('current_working', 'tested', 'block_baseline', 'phase_end')
           AND newer.recorded_at > r.recorded_at
       )
     ORDER BY e.name`,
  );
}

export async function saveOneRmRecord(
  db: Pick<TrainingDatabase, 'runAsync'>,
  input: {
    exerciseId: string;
    value: number;
    unit: 'kg' | 'lb';
    recordType?: OneRmRecordType;
    programBlockId?: string | null;
    recordedAt?: string;
  },
): Promise<OneRmRecord> {
  const now = input.recordedAt ?? new Date().toISOString();
  const record = createOneRmRecord({
    exerciseId: input.exerciseId,
    value: input.value,
    unit: input.unit,
    recordType: input.recordType ?? 'current_working',
    programBlockId: input.programBlockId ?? null,
    recordedAt: now,
  });

  await db.runAsync(
    `INSERT OR REPLACE INTO one_rm_records (
       id,
       exercise_id,
       value,
       unit,
       record_type,
       program_block_id,
       recorded_at,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.exerciseId,
    record.value,
    record.unit,
    record.recordType,
    record.programBlockId,
    record.recordedAt,
    now,
    now,
  );

  return record;
}
