import type { TrainingDatabase } from './database.ts';

export type ExerciseReplacementInput = {
  originalExerciseId: string;
  replacementExerciseId: string;
  scope: 'today_only' | 'week' | 'future_matching_in_block' | 'block' | 'year';
  reason?: string | null;
  recordedAt?: string;
};

export type ActiveExerciseReplacement = {
  id: string;
  originalExerciseId: string;
  originalName: string;
  replacementExerciseId: string;
  replacementName: string;
  scope: ExerciseReplacementInput['scope'];
  reason: string | null;
};

type ReplacementRow = {
  id: string;
  scope: ExerciseReplacementInput['scope'];
  targetEntityId: string;
  payloadJson: string;
  reason: string | null;
  originalName: string;
  replacementName: string | null;
};

export async function getActiveExerciseReplacements(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<ActiveExerciseReplacement[]> {
  const rows = await db.getAllAsync<ReplacementRow>(
    `SELECT
       pm.id,
       pm.scope,
       pm.target_entity_id AS targetEntityId,
       pm.payload_json AS payloadJson,
       pm.reason,
       original.name AS originalName,
       replacement.name AS replacementName
     FROM program_modifications pm
     JOIN exercises original ON original.id = pm.target_entity_id
     LEFT JOIN exercises replacement
       ON replacement.id = json_extract(pm.payload_json, '$.replacementExerciseId')
     WHERE pm.modification_type = 'replace_exercise'
       AND pm.is_active = 1
     ORDER BY pm.updated_at DESC`,
  );

  return rows.flatMap((row) => {
    const payload = JSON.parse(row.payloadJson) as {
      replacementExerciseId?: string;
    };
    if (!payload.replacementExerciseId || !row.replacementName) return [];

    return {
      id: row.id,
      originalExerciseId: row.targetEntityId,
      originalName: row.originalName,
      replacementExerciseId: payload.replacementExerciseId,
      replacementName: row.replacementName,
      scope: row.scope,
      reason: row.reason,
    };
  });
}

export async function saveExerciseReplacement(
  db: Pick<TrainingDatabase, 'getFirstAsync' | 'runAsync'>,
  input: ExerciseReplacementInput,
) {
  const alternative = await db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM exercise_alternatives
     WHERE source_exercise_id = ?
       AND alternative_exercise_id = ?
       AND same_primary_muscles = 1
       AND same_movement_pattern = 1`,
    input.originalExerciseId,
    input.replacementExerciseId,
  );
  if (!alternative) throw new Error('Replacement is not a faithful alternative');

  const now = input.recordedAt ?? new Date().toISOString();
  const id = `replace_${input.originalExerciseId}_${input.replacementExerciseId}_${input.scope}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO program_modifications (
       id,
       modification_type,
       scope,
       target_entity_type,
       target_entity_id,
       payload_json,
       reason,
       is_active,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    'replace_exercise',
    input.scope,
    'exercise',
    input.originalExerciseId,
    JSON.stringify({
      originalExerciseId: input.originalExerciseId,
      replacementExerciseId: input.replacementExerciseId,
    }),
    input.reason ?? null,
    1,
    now,
    now,
  );

  return id;
}

export async function restoreExerciseReplacement(
  db: Pick<TrainingDatabase, 'runAsync'>,
  modificationId: string,
  recordedAt = new Date().toISOString(),
) {
  await db.runAsync(
    `UPDATE program_modifications
     SET is_active = 0,
         updated_at = ?
     WHERE id = ?
       AND modification_type = 'replace_exercise'`,
    recordedAt,
    modificationId,
  );
}
