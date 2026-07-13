import type { PlannedSet } from './sessionPlanner';

export type RestTimer = {
  plannedSetId: string;
  startedAtMs: number;
  durationSeconds: number;
};

export function createRestTimer(
  set: Pick<PlannedSet, 'id' | 'restSecondsMin' | 'restSecondsMax'>,
  startedAtMs: number,
): RestTimer | null {
  const durationSeconds = set.restSecondsMax ?? set.restSecondsMin;
  if (durationSeconds === null || durationSeconds <= 0) {
    return null;
  }

  return {
    plannedSetId: set.id,
    startedAtMs,
    durationSeconds,
  };
}

export function getRestTimerState(timer: RestTimer, nowMs: number) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowMs - timer.startedAtMs) / 1000),
  );
  const remainingSeconds = Math.max(0, timer.durationSeconds - elapsedSeconds);

  return {
    elapsedSeconds,
    remainingSeconds,
    isComplete: remainingSeconds === 0,
  };
}
