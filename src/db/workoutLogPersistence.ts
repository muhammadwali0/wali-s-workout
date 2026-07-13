import type { TrainingDatabase } from './database.ts';
import {
  detectPersonalRecords,
  type PersonalRecord,
  type PriorExerciseRecords,
} from '../domain/analytics/personalRecords.ts';
import type { PlannedSet } from '../domain/workout/sessionPlanner.ts';
import {
  summarizeWorkoutDraft,
  type WorkoutDraft,
} from '../domain/workout/workoutLog.ts';

export type WorkoutLogPersistenceInput = {
  workoutLogId: string;
  workoutInstanceId: string;
  recordedAt: string;
  unit: 'kg' | 'lb';
};

export type WorkoutLogRows = ReturnType<typeof buildWorkoutLogRows>;

export function buildWorkoutLogRows(
  draft: WorkoutDraft,
  input: WorkoutLogPersistenceInput,
) {
  const summary = summarizeWorkoutDraft(draft);
  const plannedById = new Map(draft.plannedSets.map((set) => [set.id, set]));
  const exerciseLogs = getExerciseLogRows(draft.plannedSets, draft.actualSets, input);
  const exerciseLogByKey = new Map(
    exerciseLogs.map((row) => [`${row.exercise_id}:${row.sort_order}`, row.id]),
  );

  return {
    workoutLog: {
      id: input.workoutLogId,
      workout_instance_id: input.workoutInstanceId,
      started_at: draft.startedAt,
      completed_at: draft.status === 'completed' ? input.recordedAt : null,
      duration_seconds:
        draft.status === 'completed'
          ? getDurationSeconds(draft.startedAt, input.recordedAt)
          : null,
      status: draft.status,
      average_rpe: summary.averageRpe,
      total_volume: summary.totalVolume,
      total_working_sets: draft.actualSets.filter((set) => {
        const planned = plannedById.get(set.plannedSetId);
        return set.completed && planned?.setType !== 'warmup';
      }).length,
      user_notes: null,
      created_at: input.recordedAt,
      updated_at: input.recordedAt,
    },
    exerciseLogs,
    setLogs: draft.actualSets.map((actual) => {
      const planned = plannedById.get(actual.plannedSetId);
      if (!planned) throw new Error(`Missing planned set: ${actual.plannedSetId}`);

      return {
        id: `${input.workoutLogId}_set_${planned.id}`,
        exercise_log_id:
          exerciseLogByKey.get(`${planned.exerciseId}:${planned.exerciseOrder}`) ??
          `${input.workoutLogId}_exercise_${planned.exerciseOrder}`,
        program_set_prescription_id: null,
        set_order: planned.setNumber,
        set_type: planned.setType,
        weight: actual.weight,
        unit: input.unit,
        reps: actual.reps,
        rpe: actual.rpe,
        rir: null,
        duration_seconds: null,
        is_completed: actual.completed ? 1 : 0,
        is_pr: 0,
        is_warmup: planned.setType === 'warmup' ? 1 : 0,
        is_failed: 0,
        user_notes: actual.notes,
        created_at: input.recordedAt,
        updated_at: input.recordedAt,
      };
    }),
  };
}

export async function saveWorkoutDraft(
  db: TrainingDatabase,
  draft: WorkoutDraft,
  input: WorkoutLogPersistenceInput,
) {
  const rows = buildWorkoutLogRows(draft, input);
  const personalRecords = await getPersonalRecordRows(db, rows, input);
  const prSetIds = new Set(personalRecords.map((record) => record.set_log_id));
  rows.setLogs = rows.setLogs.map((row) => ({
    ...row,
    is_pr: prSetIds.has(row.id) ? 1 : row.is_pr,
  }));

  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_logs (
        id, workout_instance_id, started_at, completed_at, duration_seconds, status,
        average_rpe, total_volume, total_working_sets, user_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...Object.values(rows.workoutLog),
    );

    for (const row of rows.exerciseLogs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO exercise_logs (
          id, workout_log_id, program_exercise_id, exercise_id, original_exercise_id,
          was_substituted, substitution_reason, sort_order, status, user_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...Object.values(row),
      );
    }

    for (const row of rows.setLogs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO set_logs (
          id, exercise_log_id, program_set_prescription_id, set_order, set_type,
          weight, unit, reps, rpe, rir, duration_seconds, is_completed, is_pr,
          is_warmup, is_failed, user_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...Object.values(row),
      );
    }

    for (const row of personalRecords) {
      await db.runAsync(
        `INSERT OR REPLACE INTO personal_records (
          id, exercise_id, set_log_id, workout_log_id, pr_type, weight, reps,
          estimated_1rm, volume, unit, achieved_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...Object.values(row),
      );
    }

    await db.runAsync(
      `UPDATE workout_instances
       SET status = ?, actual_date = ?, updated_at = ?
       WHERE id = ?`,
      draft.status === 'completed' ? 'completed' : 'in_progress',
      draft.status === 'completed' ? input.recordedAt.slice(0, 10) : null,
      input.recordedAt,
      input.workoutInstanceId,
    );

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

function getDurationSeconds(startedAt: string, completedAt: string) {
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed)) return null;
  return Math.max(0, Math.floor((completed - started) / 1000));
}

function getExerciseLogRows(
  plannedSets: readonly PlannedSet[],
  actualSets: WorkoutDraft['actualSets'],
  input: WorkoutLogPersistenceInput,
) {
  const actualById = new Map(actualSets.map((set) => [set.plannedSetId, set]));

  return [
    ...new Map(
      plannedSets.map((set) => [
        `${set.exerciseId}:${set.exerciseOrder}`,
        {
          id: `${input.workoutLogId}_exercise_${set.exerciseOrder}`,
          workout_log_id: input.workoutLogId,
          program_exercise_id: null,
          exercise_id: set.exerciseId,
          original_exercise_id: set.originalExerciseId,
          was_substituted: set.exerciseId === set.originalExerciseId ? 0 : 1,
          substitution_reason: set.substitutionScope,
          sort_order: set.exerciseOrder,
          status: getExerciseStatus(
            plannedSets.filter((candidate) => candidate.exerciseOrder === set.exerciseOrder),
            actualById,
          ),
          user_notes: null,
          created_at: input.recordedAt,
          updated_at: input.recordedAt,
        },
      ]),
    ).values(),
  ];
}

function getExerciseStatus(
  plannedSets: readonly PlannedSet[],
  actualById: ReadonlyMap<string, WorkoutDraft['actualSets'][number]>,
) {
  const actualSets = plannedSets.map((set) => actualById.get(set.id));
  if (actualSets.every((set) => set?.skipped)) return 'skipped';
  if (actualSets.every((set) => set?.completed || set?.skipped)) return 'completed';
  return 'pending';
}

type PriorSetRow = {
  weight: number;
  reps: number;
};

async function getPersonalRecordRows(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  rows: WorkoutLogRows,
  input: WorkoutLogPersistenceInput,
) {
  const exerciseByLogId = new Map(
    rows.exerciseLogs.map((row) => [row.id, row.exercise_id]),
  );
  const records = [];

  for (const set of rows.setLogs) {
    const exerciseId = exerciseByLogId.get(set.exercise_log_id);
    if (
      !exerciseId ||
      set.is_completed !== 1 ||
      set.weight === null ||
      set.reps === null
    ) {
      continue;
    }

    const prior = await getPriorExerciseRecords(db, exerciseId, input.workoutLogId);
    for (const record of detectPersonalRecords(
      { weight: set.weight, reps: set.reps },
      prior,
    )) {
      records.push(toPersonalRecordRow(record, {
        exerciseId,
        input,
        setLogId: set.id,
        weight: set.weight,
        reps: set.reps,
      }));
    }
  }

  return records;
}

async function getPriorExerciseRecords(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  exerciseId: string,
  workoutLogId: string,
): Promise<PriorExerciseRecords> {
  const rows = await db.getAllAsync<PriorSetRow>(
    `SELECT sl.weight, sl.reps
     FROM set_logs sl
     JOIN exercise_logs el ON el.id = sl.exercise_log_id
     WHERE el.exercise_id = ?
       AND el.workout_log_id != ?
       AND sl.is_completed = 1
       AND sl.weight IS NOT NULL
       AND sl.reps IS NOT NULL`,
    exerciseId,
    workoutLogId,
  );
  const maxRepsAtWeight: Record<string, number> = {};
  let maxWeight: number | null = null;
  let estimatedOneRepMax: number | null = null;
  let maxVolume: number | null = null;

  for (const row of rows) {
    maxWeight = maxWeight === null ? row.weight : Math.max(maxWeight, row.weight);
    maxRepsAtWeight[String(row.weight)] = Math.max(
      maxRepsAtWeight[String(row.weight)] ?? 0,
      row.reps,
    );
    const estimated = row.weight * (1 + row.reps / 30);
    estimatedOneRepMax =
      estimatedOneRepMax === null
        ? estimated
        : Math.max(estimatedOneRepMax, estimated);
    const volume = row.weight * row.reps;
    maxVolume = maxVolume === null ? volume : Math.max(maxVolume, volume);
  }

  return {
    maxWeight,
    maxRepsAtWeight,
    estimatedOneRepMax,
    maxVolume,
  };
}

function toPersonalRecordRow(
  record: PersonalRecord,
  context: {
    exerciseId: string;
    input: WorkoutLogPersistenceInput;
    setLogId: string;
    weight: number;
    reps: number;
  },
) {
  const base = {
    id: `${context.setLogId}_${record.type}`,
    exercise_id: context.exerciseId,
    set_log_id: context.setLogId,
    workout_log_id: context.input.workoutLogId,
    pr_type: record.type,
    weight: null as number | null,
    reps: null as number | null,
    estimated_1rm: null as number | null,
    volume: null as number | null,
    unit: context.input.unit,
    achieved_at: context.input.recordedAt,
    created_at: context.input.recordedAt,
    updated_at: context.input.recordedAt,
  };

  if (record.type === 'max_weight') return { ...base, weight: record.value };
  if (record.type === 'rep_pr') {
    return { ...base, weight: record.weight, reps: record.reps };
  }
  if (record.type === 'estimated_1rm') {
    return { ...base, estimated_1rm: record.value };
  }
  return { ...base, volume: record.value };
}
