import type { TrainingDatabase } from './database.ts';
import type { PlannedSet } from '../domain/workout/sessionPlanner.ts';
import { skippedSetNote, type WorkoutDraft } from '../domain/workout/workoutLog.ts';

type SavedWorkoutRow = {
  workoutLogId: string;
  status: 'draft' | 'completed' | 'discarded';
  startedAt: string | null;
};

type SavedSetRow = {
  exerciseOrder: number;
  setOrder: number;
  setType: string;
  completed: number;
  failed: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
};

export async function getSavedWorkoutDraft(
  db: Pick<TrainingDatabase, 'getFirstAsync' | 'getAllAsync'>,
  workoutInstanceId: string,
  workoutId: string,
  plannedSets: readonly PlannedSet[],
): Promise<WorkoutDraft | null> {
  const log = await db.getFirstAsync<SavedWorkoutRow>(
    `SELECT id AS workoutLogId, status, started_at AS startedAt
     FROM workout_logs
     WHERE workout_instance_id = ?
       AND status IN ('draft', 'completed')
     ORDER BY COALESCE(completed_at, started_at, updated_at) DESC
     LIMIT 1`,
    workoutInstanceId,
  );
  if (!log) return null;

  const rows = await db.getAllAsync<SavedSetRow>(
    `SELECT
       el.sort_order AS exerciseOrder,
       sl.set_order AS setOrder,
       sl.set_type AS setType,
       sl.is_completed AS completed,
       sl.is_failed AS failed,
       sl.weight,
       sl.reps,
       sl.rpe,
       sl.rir,
       sl.user_notes AS notes
     FROM set_logs sl
     JOIN exercise_logs el ON el.id = sl.exercise_log_id
     WHERE el.workout_log_id = ?
     ORDER BY el.sort_order, sl.set_order`,
    log.workoutLogId,
  );
  const savedByKey = new Map(
    rows.map((row) => [`${row.exerciseOrder}:${row.setOrder}`, row]),
  );
  const recoveredPlannedSets = [
    ...plannedSets,
    ...rows.flatMap((row) => {
      if (plannedSets.some((set) => set.exerciseOrder === row.exerciseOrder && set.setNumber === row.setOrder)) {
        return [];
      }

      const source = plannedSets
        .filter((set) => set.exerciseOrder === row.exerciseOrder)
        .at(-1);
      if (!source) return [];

      return [
        {
          ...source,
          id: `${source.id}_recovered_${row.setOrder}`,
          setNumber: row.setOrder,
          setType: row.setType,
        },
      ];
    }),
  ].sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber);

  return {
    workoutId,
    startedAt: log.startedAt ?? new Date().toISOString(),
    status: log.status === 'completed' ? 'completed' : 'draft',
    plannedSets: recoveredPlannedSets,
    actualSets: recoveredPlannedSets.map((set) => {
      const saved = savedByKey.get(`${set.exerciseOrder}:${set.setNumber}`);

      return {
        plannedSetId: set.id,
        completed: saved?.completed === 1,
        skipped: saved?.completed !== 1 && saved?.notes === skippedSetNote,
        failed: saved?.failed === 1,
        weight: saved?.weight ?? null,
        reps: saved?.reps ?? null,
        rpe: saved?.rpe ?? null,
        rir: saved?.rir ?? null,
        notes: saved?.notes ?? null,
      };
    }),
  };
}
