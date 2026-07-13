import assert from 'node:assert/strict';

const { calculateAdherence } = await import('../src/domain/analytics/adherence.ts');
const { getConsistencyCalendar } = await import(
  '../src/domain/analytics/consistencyCalendar.ts'
);
const { getCalendarWorkouts, getCompletedAnalyticsSets } = await import(
  '../src/db/analyticsQueries.ts'
);

const rows = [
  {
    completedAt: '2026-01-01T10:00:00Z',
    exerciseId: 'back_squat',
    setType: 'working',
    completed: 1,
    weight: 100,
    reps: 5,
  },
];
const calls = [];
const db = {
  async getAllAsync(sql) {
    calls.push(sql);
    return rows;
  },
};

assert.deepEqual(await getCompletedAnalyticsSets(db), rows);
assert.match(calls[0], /JOIN exercise_logs/);
assert.match(calls[0], /JOIN workout_logs/);
assert.match(calls[0], /sl\.is_completed = 1/);
assert.match(calls[0], /wl\.status = 'completed'/);
assert.match(calls[0], /wl\.completed_at IS NOT NULL/);

const workouts = [
  { scheduledDate: '2026-01-01', status: 'completed' },
  { scheduledDate: '2026-01-03', status: 'missed' },
];
const calendarCalls = [];
const calendarDb = {
  async getAllAsync(sql) {
    calendarCalls.push(sql);
    return workouts;
  },
};

assert.deepEqual(await getCalendarWorkouts(calendarDb), workouts);
assert.match(calendarCalls[0], /FROM workout_instances/);
assert.match(calendarCalls[0], /ORDER BY scheduled_date, sequence_index/);
assert.deepEqual(getConsistencyCalendar(workouts), [
  { date: '2026-01-01', completed: 1, missed: 0, skipped: 0, rescheduled: 0 },
  { date: '2026-01-03', completed: 0, missed: 1, skipped: 0, rescheduled: 0 },
]);
assert.equal(calculateAdherence(workouts).completionRate, 0.5);

console.log('analytics queries verified');
