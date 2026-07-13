import type { SeedWorkout } from '../program/seedResolver';
import { getFaithfulAlternatives } from '../exercises/seedAlternatives.ts';

export type ExerciseReplacement = {
  originalExerciseId: string;
  replacementExerciseId: string;
  scope: 'today_only' | 'week' | 'future_matching_in_block' | 'block' | 'year';
};

export type ResolvedExercise = {
  programExerciseId: string;
  originalExerciseId: string;
  currentExerciseId: string;
  originalName: string;
  currentName: string;
  wasSubstituted: boolean;
  substitutionScope: ExerciseReplacement['scope'] | null;
};

export function resolveWorkoutExercises(
  workout: SeedWorkout,
  replacements: readonly ExerciseReplacement[],
): ResolvedExercise[] {
  return workout.exercises.map((exercise) => {
    const replacement = replacements.find(
      (candidate) => candidate.originalExerciseId === exercise.exerciseId,
    );

    if (!replacement) {
      return {
        programExerciseId: exercise.id,
        originalExerciseId: exercise.exerciseId,
        currentExerciseId: exercise.exerciseId,
        originalName: exercise.name,
        currentName: exercise.name,
        wasSubstituted: false,
        substitutionScope: null,
      };
    }

    const alternative = getFaithfulAlternatives(exercise.exerciseId).find(
      (candidate) => candidate.exerciseId === replacement.replacementExerciseId,
    );

    if (!alternative) {
      throw new Error('Replacement is not a faithful alternative');
    }

    return {
      programExerciseId: exercise.id,
      originalExerciseId: exercise.exerciseId,
      currentExerciseId: alternative.exerciseId,
      originalName: exercise.name,
      currentName: alternative.name,
      wasSubstituted: true,
      substitutionScope: replacement.scope,
    };
  });
}
