import type { TrainingDatabase } from './database.ts';

export type PersonalRecordItem = {
  recordId: string;
  exerciseId: string;
  exerciseName: string;
  prType: 'max_weight' | 'rep_pr' | 'estimated_1rm' | 'volume_pr';
  weight: number | null;
  reps: number | null;
  estimatedOneRm: number | null;
  volume: number | null;
  unit: 'kg' | 'lb' | null;
  achievedAt: string;
};

export async function getRecentPersonalRecords(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 10,
): Promise<PersonalRecordItem[]> {
  return db.getAllAsync<PersonalRecordItem>(
    `SELECT
       pr.id AS recordId,
       pr.exercise_id AS exerciseId,
       e.name AS exerciseName,
       pr.pr_type AS prType,
       pr.weight,
       pr.reps,
       pr.estimated_1rm AS estimatedOneRm,
       pr.volume,
       pr.unit,
       pr.achieved_at AS achievedAt
     FROM personal_records pr
     JOIN exercises e ON e.id = pr.exercise_id
     ORDER BY pr.achieved_at DESC
     LIMIT ?`,
    limit,
  );
}
