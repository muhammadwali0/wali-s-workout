import type { TrainingDatabase } from './database.ts';

export type ExerciseReplacementInput = {
  originalExerciseId: string;
  replacementExerciseId: string;
  scope: 'today_only' | 'week' | 'future_matching_in_block' | 'block' | 'year';
  reason?: string | null;
  recordedAt?: string;
};

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
