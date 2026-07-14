import type { PlannedSet } from './sessionPlanner';

export type RestTimer = {
  plannedSetId: string;
  startedAtMs: number;
  durationSeconds: number;
  pausedAtMs: number | null;
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
    pausedAtMs: null,
  };
}

export function getRestTimerState(timer: RestTimer, nowMs: number) {
  const effectiveNowMs = timer.pausedAtMs ?? nowMs;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((effectiveNowMs - timer.startedAtMs) / 1000),
  );
  const remainingSeconds = Math.max(0, timer.durationSeconds - elapsedSeconds);

  return {
    elapsedSeconds,
    remainingSeconds,
    isComplete: remainingSeconds === 0,
    isPaused: timer.pausedAtMs !== null,
  };
}

export function addRestTime(timer: RestTimer, seconds: number): RestTimer {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('rest extension must be positive');
  }

  return {
    ...timer,
    durationSeconds: timer.durationSeconds + Math.round(seconds),
  };
}

export function pauseRestTimer(timer: RestTimer, pausedAtMs: number): RestTimer {
  if (timer.pausedAtMs !== null) return timer;
  return { ...timer, pausedAtMs };
}

export function resumeRestTimer(timer: RestTimer, resumedAtMs: number): RestTimer {
  if (timer.pausedAtMs === null) return timer;

  return {
    ...timer,
    startedAtMs: timer.startedAtMs + Math.max(0, resumedAtMs - timer.pausedAtMs),
    pausedAtMs: null,
  };
}
