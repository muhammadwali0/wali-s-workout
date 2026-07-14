import type { CalendarWorkout } from './consistencyCalendar.ts';

export type FatigueSignalSet = {
  completedAt: string;
  completed: boolean;
  setType: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  failed: number;
};

export type FatigueSignals = {
  riskLevel: 'low' | 'moderate' | 'high';
  workingSets: number;
  failedSets: number;
  highRpeSets: number;
  lowRirSets: number;
  missedSessions: number;
  performanceDropSignals: number;
  latestWeekVolume: number;
  priorWeekVolume: number;
};

export function calculateFatigueSignals(
  sets: readonly FatigueSignalSet[],
  workouts: readonly CalendarWorkout[],
): FatigueSignals {
  const workingSets = sets.filter(
    (set) => set.completed && set.setType !== 'warmup',
  );
  const failedSets = workingSets.filter((set) => set.failed === 1).length;
  const highRpeSets = workingSets.filter((set) => (set.rpe ?? 0) >= 9).length;
  const lowRirSets = workingSets.filter(
    (set) => set.rir !== null && set.rir <= 1,
  ).length;
  const missedSessions = workouts.filter((workout) => workout.status === 'missed').length;
  const weeklyVolumes = getWeeklyVolumes(workingSets);
  const latestWeek = weeklyVolumes.at(-1);
  const priorWeek = weeklyVolumes.at(-2);
  const latestWeekVolume = latestWeek?.volume ?? 0;
  const priorWeekVolume = priorWeek?.volume ?? 0;
  const performanceDropSignals =
    priorWeekVolume > 0 && latestWeekVolume < priorWeekVolume * 0.9 ? 1 : 0;
  const load =
    failedSets * 3 +
    highRpeSets +
    lowRirSets +
    missedSessions * 2 +
    performanceDropSignals * 2;

  return {
    riskLevel: load >= 8 ? 'high' : load >= 4 ? 'moderate' : 'low',
    workingSets: workingSets.length,
    failedSets,
    highRpeSets,
    lowRirSets,
    missedSessions,
    performanceDropSignals,
    latestWeekVolume,
    priorWeekVolume,
  };
}

function getWeeklyVolumes(sets: readonly FatigueSignalSet[]) {
  const byWeek = new Map<string, { weekKey: string; volume: number }>();

  for (const set of sets) {
    const weekKey = getWeekKey(set.completedAt);
    const current = byWeek.get(weekKey) ?? { weekKey, volume: 0 };
    current.volume += (set.weight ?? 0) * (set.reps ?? 0);
    byWeek.set(weekKey, current);
  }

  return [...byWeek.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

function getWeekKey(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
