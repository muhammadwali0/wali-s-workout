import assert from 'node:assert/strict';

const {
  getRecentWorkoutHistory,
  getWorkoutHistorySets,
  updateWorkoutHistorySet,
} = await import('../src/db/historyQueries.ts');

const rows = [
  {
    workoutLogId: 'log_1',
    workoutName: 'Day 1',
    status: 'completed',
    scheduledDate: '2026-01-01',
    completedAt: '2026-01-01T10:30:00Z',
    durationSeconds: 1800,
    totalVolume: 500,
    totalWorkingSets: 3,
    averageRpe: 7,
    personalRecordCount: 2,
    failedSetCount: 1,
    lastSetNote: 'Felt stable',
  },
];
const calls = [];
const db = {
  async getAllAsync(sql, limit) {
    calls.push({ sql, limit });
    if (sql.includes('JOIN exercises e')) {
      return [
        {
          setLogId: 'set_1',
          exerciseName: 'Squat',
          setOrder: 1,
          setType: 'working',
          weight: 100,
          unit: 'kg',
          reps: 5,
          rpe: 8,
          rir: null,
          isCompleted: 1,
          isFailed: 0,
          userNotes: 'solid',
        },
      ];
    }
    return rows;
  },
  async execAsync(sql) {
    calls.push({ type: 'exec', sql });
  },
  async runAsync(sql, ...params) {
    calls.push({ type: 'run', sql, params });
  },
};

assert.deepEqual(await getRecentWorkoutHistory(db, 5), rows);
assert.equal(calls[0].limit, 5);
assert.match(calls[0].sql, /FROM workout_logs/);
assert.match(calls[0].sql, /JOIN workout_instances/);
assert.match(calls[0].sql, /JOIN program_workouts/);
assert.match(calls[0].sql, /wl\.duration_seconds AS durationSeconds/);
assert.match(calls[0].sql, /FROM personal_records pr/);
assert.match(calls[0].sql, /AS personalRecordCount/);
assert.match(calls[0].sql, /sl\.is_failed = 1/);
assert.match(calls[0].sql, /AS failedSetCount/);
assert.match(calls[0].sql, /sl\.user_notes AS lastSetNote|AS lastSetNote/);
assert.match(calls[0].sql, /FROM set_logs sl/);
assert.match(calls[0].sql, /LIMIT \?/);

const sets = await getWorkoutHistorySets(db, 'log_1');
assert.equal(sets[0].setLogId, 'set_1');
assert.match(calls[1].sql, /JOIN exercise_logs/);
assert.match(calls[1].sql, /JOIN exercises/);
assert.match(calls[1].sql, /WHERE el\.workout_log_id = \?/);
assert.equal(calls[1].limit, 'log_1');

await updateWorkoutHistorySet(db, {
  workoutLogId: 'log_1',
  setLogId: 'set_1',
  weight: 102.5,
  reps: 5,
  rpe: 8.5,
  notes: 'corrected',
});
assert.equal(calls[2].sql, 'BEGIN TRANSACTION');
assert.match(calls[3].sql, /UPDATE set_logs/);
assert.deepEqual(calls[3].params.slice(0, 4), [102.5, 5, 8.5, 'corrected']);
assert.match(calls[4].sql, /UPDATE workout_logs/);
assert.match(calls[4].sql, /SUM\(COALESCE\(sl\.weight, 0\) \* COALESCE\(sl\.reps, 0\)\)/);
assert.match(calls[4].sql, /AVG\(sl\.rpe\)/);
assert.equal(calls[4].params[1], 'log_1');
assert.equal(calls[5].sql, 'COMMIT');

await assert.rejects(
  updateWorkoutHistorySet(db, {
      workoutLogId: 'log_1',
      setLogId: 'set_1',
      weight: -1,
      reps: 5,
      rpe: 8,
      notes: null,
    }),
  /weight/,
);
await assert.rejects(
  updateWorkoutHistorySet(db, {
      workoutLogId: 'log_1',
      setLogId: 'set_1',
      weight: 100,
      reps: 0,
      rpe: 8,
      notes: null,
    }),
  /reps/,
);
await assert.rejects(
  updateWorkoutHistorySet(db, {
      workoutLogId: 'log_1',
      setLogId: 'set_1',
      weight: 100,
      reps: 5,
      rpe: 11,
      notes: null,
    }),
  /rpe/,
);

console.log('history queries verified');
