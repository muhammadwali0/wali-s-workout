export type ExerciseProfile = {
  id: string;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  movementPattern: string;
  role: 'primary' | 'secondary' | 'tertiary';
  equipment?: string;
};

export type AlternativeScore = {
  candidateId: string;
  score: number;
  isFaithful: boolean;
  reasons: string[];
};

export function scoreAlternative(
  source: ExerciseProfile,
  candidate: ExerciseProfile,
): AlternativeScore {
  const primaryOverlap = countOverlap(source.primaryMuscles, candidate.primaryMuscles);
  const samePattern = source.movementPattern === candidate.movementPattern;
  const sameRole = source.role === candidate.role;
  const sameEquipment = Boolean(
    source.equipment && candidate.equipment && source.equipment === candidate.equipment,
  );
  const secondaryOverlap = countOverlap(
    source.secondaryMuscles ?? [],
    candidate.secondaryMuscles ?? [],
  );

  let score = 0;
  const reasons: string[] = [];

  if (primaryOverlap > 0) {
    score += Math.min(45, primaryOverlap * 30);
    reasons.push('Primary muscle match');
  }

  if (samePattern) {
    score += 30;
    reasons.push('Movement pattern match');
  }

  if (sameRole) {
    score += 15;
    reasons.push('Session role match');
  }

  if (sameEquipment) {
    score += 5;
    reasons.push('Equipment match');
  }

  if (secondaryOverlap > 0) {
    score += 5;
    reasons.push('Secondary muscle overlap');
  }

  const boundedScore = Math.min(100, score);

  return {
    candidateId: candidate.id,
    score: boundedScore,
    isFaithful: primaryOverlap > 0 && samePattern && boundedScore >= 60,
    reasons,
  };
}

export function rankAlternatives(
  source: ExerciseProfile,
  candidates: ExerciseProfile[],
) {
  return candidates
    .map((candidate) => scoreAlternative(source, candidate))
    .sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId));
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
}
