import type { TrainingDatabase } from './database.ts';

export type ExerciseReplacementInput = {
  originalExerciseId: string;
  replacementExerciseId: string;
  scope: 'today_only' | 'week' | 'future_matching_in_block' | 'block' | 'year';
  reason?: string | null;
  recordedAt?: string;
};

export type CustomAlternativeInput = {
  sourceExerciseId: string;
  name: string;
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

export async function saveCustomAlternative(
  db: Pick<TrainingDatabase, 'getFirstAsync' | 'runAsync'>,
  input: CustomAlternativeInput,
) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error('Enter a custom alternative name');

  const source = await db.getFirstAsync<{
    id: string;
    category: string | null;
    movementPattern: string;
    equipment: string | null;
    defaultRole: string | null;
  }>(
    `SELECT
       id,
       category,
       movement_pattern AS movementPattern,
       equipment,
       default_role AS defaultRole
     FROM exercises
     WHERE id = ?`,
    input.sourceExerciseId,
  );
  if (!source) throw new Error('Source exercise not found');

  const now = input.recordedAt ?? new Date().toISOString();
  const exerciseId = `custom_${source.id}_${slugify(name)}`;
  const alternativeId = `custom_alt_${source.id}_${exerciseId}`;

  await db.runAsync(
    `INSERT OR REPLACE INTO exercises (
       id,
       name,
       category,
       movement_pattern,
       equipment,
       default_role,
       is_unilateral,
       is_bodyweight,
       instructions,
       program_notes,
       user_notes,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL, ?, ?, ?)`,
    exerciseId,
    name,
    source.category,
    source.movementPattern,
    source.equipment,
    source.defaultRole,
    'Custom faithful alternative',
    now,
    now,
  );
  await db.runAsync(
    `INSERT OR REPLACE INTO exercise_muscles (
       id,
       exercise_id,
       muscle_id,
       involvement_type,
       contribution_weight,
       created_at,
       updated_at
     )
     SELECT
       ? || '_' || muscle_id || '_' || involvement_type,
       ?,
       muscle_id,
       involvement_type,
       contribution_weight,
       ?,
       ?
     FROM exercise_muscles
     WHERE exercise_id = ?`,
    exerciseId,
    exerciseId,
    now,
    now,
    source.id,
  );
  await db.runAsync(
    `INSERT OR REPLACE INTO exercise_alternatives (
       id,
       source_exercise_id,
       alternative_exercise_id,
       compatibility_score,
       reason,
       same_primary_muscles,
       same_movement_pattern,
       same_role,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, 100, ?, 1, 1, 1, ?, ?)`,
    alternativeId,
    source.id,
    exerciseId,
    'Custom alternative using the source exercise stimulus metadata',
    now,
    now,
  );

  return { exerciseId, alternativeId };
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}
