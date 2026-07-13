export type RpeSet = {
  completedAt: string;
  setType: string;
  completed: boolean;
  rpe: number | null;
};

export type WeeklyRpePoint = {
  weekKey: string;
  averageRpe: number;
  ratedSets: number;
};

export function getWeeklyAverageRpe(sets: readonly RpeSet[]): WeeklyRpePoint[] {
  const byWeek = new Map<string, { weekKey: string; totalRpe: number; ratedSets: number }>();

  for (const set of sets) {
    if (!set.completed || set.setType === 'warmup' || set.rpe === null) continue;

    const weekKey = getWeekKey(set.completedAt);
    const current = byWeek.get(weekKey) ?? {
      weekKey,
      totalRpe: 0,
      ratedSets: 0,
    };

    current.totalRpe += set.rpe;
    current.ratedSets += 1;
    byWeek.set(weekKey, current);
  }

  return [...byWeek.values()]
    .map((point) => ({
      weekKey: point.weekKey,
      averageRpe: point.totalRpe / point.ratedSets,
      ratedSets: point.ratedSets,
    }))
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

function getWeekKey(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
