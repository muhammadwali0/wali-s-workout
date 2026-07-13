import assert from 'node:assert/strict';

const {
  getLatestExercisePerformances,
  getNextWorkoutInstance,
  getTodayWorkoutInstance,
} = await import('../src/db/todayWorkoutQuery.ts');

const row = {
  instanceId: 'instance_1',
  programWorkoutId: 'workout_1',
  scheduledDate: '2026-01-01',
  status: 'scheduled',
  workoutName: 'Day 1',
  workoutType: 'training',
  estimatedDurationMin: 55,
};
const calls = [];
const db = {
  async getFirstAsync(sql, date) {
    calls.push({ sql, date });
    return row;
  },
  async getAllAsync(sql, ...exerciseIds) {
    calls.push({ sql, exerciseIds });
    return [
      {
        exerciseId: 'back_squat',
        weight: 120,
        reps: 5,
        rpe: 8,
        completedAt: '2026-01-01T10:00:00Z',
      },
    ];
  },
};

assert.deepEqual(await getTodayWorkoutInstance(db, '2026-01-01T10:00:00Z'), row);
assert.equal(calls[0].date, '2026-01-01');
assert.match(calls[0].sql, /FROM workout_instances/);
assert.match(calls[0].sql, /JOIN program_workouts/);
assert.match(calls[0].sql, /WHERE wi\.scheduled_date = \?/);
assert.match(calls[0].sql, /LIMIT 1/);

assert.deepEqual(await getNextWorkoutInstance(db, '2026-01-01T10:00:00Z'), row);
assert.equal(calls[1].date, '2026-01-01');
assert.match(calls[1].sql, /wi\.scheduled_date > \?/);
assert.match(calls[1].sql, /pw\.workout_type IN/);
assert.match(calls[1].sql, /ORDER BY wi\.scheduled_date, wi\.sequence_index/);

assert.deepEqual(await getLatestExercisePerformances(db, []), []);
assert.deepEqual(await getLatestExercisePerformances(db, ['back_squat', 'back_squat']), [
  {
    exerciseId: 'back_squat',
    weight: 120,
    reps: 5,
    rpe: 8,
    completedAt: '2026-01-01T10:00:00Z',
  },
]);
assert.deepEqual(calls[2].exerciseIds, ['back_squat']);
assert.match(calls[2].sql, /FROM set_logs sl/);
assert.match(calls[2].sql, /ROW_NUMBER\(\) OVER/);
assert.match(calls[2].sql, /PARTITION BY el\.exercise_id/);

console.log('today workout query verified');
