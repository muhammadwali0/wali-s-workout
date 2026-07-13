export type VolumeSet = {
  completedAt: string;
  setType: string;
  completed: boolean;
  weight: number | null;
  reps: number | null;
};

export type WeeklyVolumePoint = {
  weekKey: string;
  totalVolume: number;
  totalSets: number;
};

export function getWeeklyVolume(sets: readonly VolumeSet[]): WeeklyVolumePoint[] {
  const byWeek = new Map<string, WeeklyVolumePoint>();

  for (const set of sets) {
    if (!set.completed || set.setType === 'warmup') continue;

    const weekKey = getWeekKey(set.completedAt);
    const current = byWeek.get(weekKey) ?? {
      weekKey,
      totalVolume: 0,
      totalSets: 0,
    };

    current.totalVolume += (set.weight ?? 0) * (set.reps ?? 0);
    current.totalSets += 1;
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
