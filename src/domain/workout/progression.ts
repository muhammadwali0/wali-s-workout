export type RepRangeProgressionInput = {
  currentLoad: number;
  reps: readonly number[];
  targetRepsMin: number;
  targetRepsMax: number;
  loadIncrement: number;
};

export type RepRangeProgression = {
  nextLoad: number;
  nextTargetReps: number;
  progressedLoad: boolean;
};

export function progressRepRange(
  input: RepRangeProgressionInput,
): RepRangeProgression {
  validate(input);

  const allAtTop = input.reps.every((reps) => reps >= input.targetRepsMax);
  if (allAtTop) {
    return {
      nextLoad: input.currentLoad + input.loadIncrement,
      nextTargetReps: input.targetRepsMin,
      progressedLoad: true,
    };
  }

  return {
    nextLoad: input.currentLoad,
    nextTargetReps: Math.min(Math.max(...input.reps) + 1, input.targetRepsMax),
    progressedLoad: false,
  };
}

function validate(input: RepRangeProgressionInput) {
  if (input.targetRepsMin < 1 || input.targetRepsMin > input.targetRepsMax) {
    throw new Error('target rep range is invalid');
  }
  if (!Number.isFinite(input.currentLoad) || input.currentLoad < 0) {
    throw new Error('currentLoad must be non-negative');
  }
  if (!Number.isFinite(input.loadIncrement) || input.loadIncrement <= 0) {
    throw new Error('loadIncrement must be positive');
  }
  if (input.reps.length === 0 || input.reps.some((reps) => !Number.isInteger(reps) || reps < 1)) {
    throw new Error('reps must contain positive integers');
  }
}
