import assert from 'node:assert/strict';

const { formatCalendarDayLabel, getConsistencyCalendar } = await import(
  '../src/domain/analytics/consistencyCalendar.ts'
);

assert.deepEqual(
  getConsistencyCalendar([
    { scheduledDate: '2026-01-01T10:00:00Z', status: 'completed' },
    { scheduledDate: '2026-01-01T12:00:00Z', status: 'missed' },
    { scheduledDate: '2026-01-02', status: 'scheduled' },
    { scheduledDate: '2026-01-03', status: 'rescheduled' },
    { scheduledDate: '2026-01-03', status: 'skipped' },
  ]),
  [
    { date: '2026-01-01', completed: 1, missed: 1, skipped: 0, rescheduled: 0 },
    { date: '2026-01-02', completed: 0, missed: 0, skipped: 0, rescheduled: 0 },
    { date: '2026-01-03', completed: 0, missed: 0, skipped: 1, rescheduled: 1 },
  ],
);

assert.equal(
  formatCalendarDayLabel({
    date: '2026-01-03',
    completed: 0,
    missed: 1,
    skipped: 2,
    rescheduled: 1,
  }),
  '2026-01-03: 0 completed, 1 missed, 2 skipped, 1 rescheduled',
);

console.log('consistency calendar verified');
