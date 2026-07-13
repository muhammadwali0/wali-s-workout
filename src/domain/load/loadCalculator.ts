export type LoadBracket = {
  low: number;
  high: number;
  roundedLow: number;
  roundedHigh: number;
};

export function calculatePercentLoad(oneRepMax: number, percent: number) {
  assertPositive(oneRepMax, 'oneRepMax');
  assertPositive(percent, 'percent');
  return oneRepMax * (percent / 100);
}

export function calculateBracket(
  oneRepMax: number,
  lowPercent: number,
  highPercent: number,
  increment: number,
): LoadBracket {
  if (lowPercent > highPercent) {
    throw new Error('lowPercent must be less than or equal to highPercent');
  }

  const low = calculatePercentLoad(oneRepMax, lowPercent);
  const high = calculatePercentLoad(oneRepMax, highPercent);

  return {
    low,
    high,
    roundedLow: roundToIncrement(low, increment),
    roundedHigh: roundToIncrement(high, increment),
  };
}

export function roundToIncrement(load: number, increment: number) {
  assertNonNegative(load, 'load');
  assertPositive(increment, 'increment');
  return Math.round(load / increment) * increment;
}

export function estimateOneRepMax(weight: number, reps: number) {
  assertPositive(weight, 'weight');

  if (!Number.isInteger(reps) || reps < 1) {
    throw new Error('reps must be a positive integer');
  }

  if (reps === 1) {
    return weight;
  }

  return weight * (1 + reps / 30);
}

function assertPositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

function assertNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
}
