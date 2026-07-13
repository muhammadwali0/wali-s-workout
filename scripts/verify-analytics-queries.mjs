import assert from 'node:assert/strict';

const { calculateAdherence } = await import('../src/domain/analytics/adherence.ts');
const { getConsistencyCalendar } = await import(
  '../src/domain/analytics/consistencyCalendar.ts'
);
const {
  getCalendarWorkouts,
  getCompletedAnalyticsSets,
  getEstimatedOneRmTrend,
  getPlannedVsActualWorkouts,
  getSessionDurationPoints,
} = await import('../src/db/analyticsQueries.ts');

const rows = [
  {
    completedAt: '2026-01-01T10:00:00Z',
    exerciseId: 'back_squat',
    exerciseCategory: 'barbell',
    blockNumber: 1,
    phaseCode: 'phase1',
    setType: 'working',
    completed: 1,
    weight: 100,
    reps: 5,
    rpe: 8,
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
assert.match(calls[0], /JOIN exercises e/);
assert.match(calls[0], /JOIN workout_logs/);
assert.match(calls[0], /JOIN workout_instances/);
assert.match(calls[0], /JOIN program_blocks/);
assert.match(calls[0], /sl\.rpe/);
assert.match(calls[0], /e\.category AS exerciseCategory/);
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

const strengthRows = [
  {
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    estimatedOneRm: 150,
    unit: 'kg',
    achievedAt: '2026-01-01T10:00:00Z',
  },
];
const strengthCalls = [];
const strengthDb = {
  async getAllAsync(sql, limit) {
    strengthCalls.push({ sql, limit });
    return strengthRows;
  },
};
assert.deepEqual(await getEstimatedOneRmTrend(strengthDb, 3), strengthRows);
assert.equal(strengthCalls[0].limit, 3);
assert.match(strengthCalls[0].sql, /FROM personal_records/);
assert.match(strengthCalls[0].sql, /pr_type = 'estimated_1rm'/);
assert.match(strengthCalls[0].sql, /ORDER BY pr\.achieved_at DESC/);

const plannedActualRows = [
  {
    instanceId: 'instance_1',
    workoutName: 'Day 1',
    scheduledDate: '2026-01-01',
    plannedWorkingSets: 12,
    actualWorkingSets: 10,
  },
];
const plannedActualCalls = [];
const plannedActualDb = {
  async getAllAsync(sql, limit) {
    plannedActualCalls.push({ sql, limit });
    return plannedActualRows;
  },
};
assert.deepEqual(await getPlannedVsActualWorkouts(plannedActualDb, 4), plannedActualRows);
assert.equal(plannedActualCalls[0].limit, 4);
assert.match(plannedActualCalls[0].sql, /program_set_prescriptions/);
assert.match(plannedActualCalls[0].sql, /wl\.total_working_sets/);
assert.match(plannedActualCalls[0].sql, /wi\.status IN \('in_progress', 'completed'\)/);

const durationRows = [
  {
    workoutLogId: 'log_1',
    workoutName: 'Day 1',
    completedAt: '2026-01-01T10:30:00Z',
    durationSeconds: 1800,
  },
];
const durationCalls = [];
const durationDb = {
  async getAllAsync(sql, limit) {
    durationCalls.push({ sql, limit });
    return durationRows;
  },
};
assert.deepEqual(await getSessionDurationPoints(durationDb, 6), durationRows);
assert.equal(durationCalls[0].limit, 6);
assert.match(durationCalls[0].sql, /wl\.duration_seconds AS durationSeconds/);
assert.match(durationCalls[0].sql, /JOIN workout_instances/);
assert.match(durationCalls[0].sql, /wl\.status = 'completed'/);
assert.match(durationCalls[0].sql, /wl\.duration_seconds IS NOT NULL/);

console.log('analytics queries verified');
