import type { CalendarWorkout } from './consistencyCalendar.ts';

export type TrainingFrequencyPoint = {
  weekKey: string;
  completed: number;
  scheduled: number;
};

export function getTrainingFrequency(
  workouts: readonly CalendarWorkout[],
): TrainingFrequencyPoint[] {
  const byWeek = new Map<string, TrainingFrequencyPoint>();

  for (const workout of workouts) {
    const weekKey = getWeekKey(workout.scheduledDate);
    const current = byWeek.get(weekKey) ?? {
      weekKey,
      completed: 0,
      scheduled: 0,
    };

    current.scheduled += 1;
    if (workout.status === 'completed') current.completed += 1;
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
