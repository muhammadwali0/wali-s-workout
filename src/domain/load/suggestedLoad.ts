import { calculateBracket, type LoadBracket } from './loadCalculator.ts';

export type PercentPrescription = {
  exerciseId: string;
  percent1RmLow: number | null;
  percent1RmHigh: number | null;
};

export type ExerciseOneRm = {
  exerciseId: string;
  value: number;
};

export function getSuggestedLoad(
  prescription: PercentPrescription,
  records: readonly ExerciseOneRm[],
  increment: number,
): LoadBracket | null {
  if (
    prescription.percent1RmLow === null &&
    prescription.percent1RmHigh === null
  ) {
    return null;
  }

  const record = records.find(
    (candidate) => candidate.exerciseId === prescription.exerciseId,
  );
  if (!record) return null;

  const low = prescription.percent1RmLow ?? prescription.percent1RmHigh;
  const high = prescription.percent1RmHigh ?? prescription.percent1RmLow;
  if (low === null || high === null) return null;

  return calculateBracket(record.value, low, high, increment);
}
