import type { TrainingDatabase } from './database.ts';

export type ExerciseAlternativeItem = {
  sourceExerciseId: string;
  sourceName: string;
  alternativeExerciseId: string;
  alternativeName: string;
  compatibilityScore: number;
  reason: string | null;
};

export async function getExerciseAlternatives(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
): Promise<ExerciseAlternativeItem[]> {
  return db.getAllAsync<ExerciseAlternativeItem>(
    `SELECT
       ea.source_exercise_id AS sourceExerciseId,
       source.name AS sourceName,
       ea.alternative_exercise_id AS alternativeExerciseId,
       alternative.name AS alternativeName,
       ea.compatibility_score AS compatibilityScore,
       ea.reason
     FROM exercise_alternatives ea
     JOIN exercises source ON source.id = ea.source_exercise_id
     JOIN exercises alternative ON alternative.id = ea.alternative_exercise_id
     WHERE ea.same_primary_muscles = 1
       AND ea.same_movement_pattern = 1
     ORDER BY ea.source_exercise_id, ea.compatibility_score DESC, alternative.name`,
  );
}
