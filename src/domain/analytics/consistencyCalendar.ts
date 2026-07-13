export type CalendarWorkout = {
  scheduledDate: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'missed' | 'rescheduled';
};

export type CalendarDay = {
  date: string;
  completed: number;
  missed: number;
  skipped: number;
  rescheduled: number;
};

export function getConsistencyCalendar(
  workouts: readonly CalendarWorkout[],
): CalendarDay[] {
  const days = new Map<string, CalendarDay>();

  for (const workout of workouts) {
    const date = workout.scheduledDate.slice(0, 10);
    const current = days.get(date) ?? {
      date,
      completed: 0,
      missed: 0,
      skipped: 0,
      rescheduled: 0,
    };

    if (workout.status === 'completed') current.completed += 1;
    if (workout.status === 'missed') current.missed += 1;
    if (workout.status === 'skipped') current.skipped += 1;
    if (workout.status === 'rescheduled') current.rescheduled += 1;
    days.set(date, current);
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
