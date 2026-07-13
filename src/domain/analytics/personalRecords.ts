import { estimateOneRepMax } from '../load/loadCalculator.ts';

export type PriorExerciseRecords = {
  maxWeight: number | null;
  maxRepsAtWeight: Record<string, number>;
  estimatedOneRepMax: number | null;
  maxVolume: number | null;
};

export type PersonalRecord =
  | { type: 'max_weight'; value: number }
  | { type: 'rep_pr'; weight: number; reps: number }
  | { type: 'estimated_1rm'; value: number }
  | { type: 'volume_pr'; value: number };

export function detectPersonalRecords(
  set: { weight: number; reps: number },
  prior: PriorExerciseRecords,
): PersonalRecord[] {
  if (!Number.isFinite(set.weight) || set.weight < 0) {
    throw new Error('weight must be a non-negative number');
  }
  if (!Number.isInteger(set.reps) || set.reps < 1) {
    throw new Error('reps must be a positive integer');
  }

  const records: PersonalRecord[] = [];
  const volume = set.weight * set.reps;
  const estimated = set.weight === 0 ? 0 : estimateOneRepMax(set.weight, set.reps);

  if (prior.maxWeight === null || set.weight > prior.maxWeight) {
    records.push({ type: 'max_weight', value: set.weight });
  }

  const previousReps = prior.maxRepsAtWeight[String(set.weight)] ?? 0;
  if (set.reps > previousReps) {
    records.push({ type: 'rep_pr', weight: set.weight, reps: set.reps });
  }

  if (
    set.weight > 0 &&
    (prior.estimatedOneRepMax === null || estimated > prior.estimatedOneRepMax)
  ) {
    records.push({ type: 'estimated_1rm', value: estimated });
  }

  if (prior.maxVolume === null || volume > prior.maxVolume) {
    records.push({ type: 'volume_pr', value: volume });
  }

  return records;
}
