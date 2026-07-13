import type { TrainingDatabase } from './database.ts';

export type ExerciseLibraryItem = {
  exerciseId: string;
  name: string;
  category: string | null;
  movementPattern: string;
  equipment: string | null;
  defaultRole: 'primary' | 'secondary' | 'tertiary' | null;
  primaryMuscles: string | null;
  alternativeCount: number;
};

export async function getExerciseLibrary(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 20,
): Promise<ExerciseLibraryItem[]> {
  return db.getAllAsync<ExerciseLibraryItem>(
    `SELECT
       e.id AS exerciseId,
       e.name,
       e.category,
       e.movement_pattern AS movementPattern,
       e.equipment,
       e.default_role AS defaultRole,
       GROUP_CONCAT(DISTINCT m.name) AS primaryMuscles,
       COUNT(DISTINCT ea.id) AS alternativeCount
     FROM exercises e
     LEFT JOIN exercise_muscles em
       ON em.exercise_id = e.id
      AND em.involvement_type = 'primary'
     LEFT JOIN muscles m ON m.id = em.muscle_id
     LEFT JOIN exercise_alternatives ea ON ea.source_exercise_id = e.id
     GROUP BY e.id
     ORDER BY e.name
     LIMIT ?`,
    limit,
  );
}
