import { programSeed } from '../../data/programSeed.ts';

import { scoreAlternative, type ExerciseProfile } from './alternativeRanker.ts';

type SeedExercise = (typeof programSeed.exercises)[number];

export type FaithfulAlternative = {
  exerciseId: string;
  name: string;
  compatibilityScore: number;
  reasons: string[];
};

const exerciseById: Map<string, SeedExercise> = new Map(
  programSeed.exercises.map((exercise) => [exercise.id, exercise]),
);

export function getExerciseProfile(exerciseId: string): ExerciseProfile | null {
  const exercise = exerciseById.get(exerciseId);
  if (!exercise) return null;

  return {
    id: exercise.id,
    primaryMuscles: exercise.muscles
      .filter((muscle) => muscle.role === 'primary')
      .map((muscle) => muscle.muscleId),
    secondaryMuscles: exercise.muscles
      .filter((muscle) => muscle.role === 'secondary')
      .map((muscle) => muscle.muscleId),
    movementPattern: exercise.movementPattern,
    role: exercise.defaultRole,
    equipment: exercise.equipment,
  };
}

export function getFaithfulAlternatives(exerciseId: string): FaithfulAlternative[] {
  const source = getExerciseProfile(exerciseId);
  if (!source) return [];

  const alternatives: FaithfulAlternative[] = [];

  for (const alternative of programSeed.exerciseAlternatives.filter(
    (candidate) => candidate.sourceExerciseId === exerciseId,
  )) {
    const candidate = exerciseById.get(alternative.alternativeExerciseId);
    const candidateProfile = candidate ? getExerciseProfile(candidate.id) : null;
    if (!candidate || !candidateProfile) continue;

    const score = scoreAlternative(source, candidateProfile);
    if (!score.isFaithful || !alternative.sameMovementPattern) continue;

    alternatives.push({
      exerciseId: candidate.id,
      name: candidate.name,
      compatibilityScore: alternative.compatibilityScore,
      reasons: [
        `Shared primary muscles: ${alternative.sharedPrimaryMuscles.join(', ')}`,
        'Movement pattern match',
        ...score.reasons.filter((reason) => reason !== 'Movement pattern match'),
      ],
    });
  }

  return alternatives.sort(
    (a, b) =>
      b.compatibilityScore - a.compatibilityScore ||
      a.name.localeCompare(b.name),
  );
}
