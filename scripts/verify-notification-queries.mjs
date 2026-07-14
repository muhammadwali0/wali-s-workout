import assert from 'node:assert/strict';

const {
  getNotificationSettings,
  getScheduledNotifications,
  saveNotificationSettings,
  savePlannedNotification,
} = await import('../src/db/notificationQueries.ts');

const calls = [];
const db = {
  async runAsync(sql, ...params) {
    calls.push({ type: 'run', sql, params });
  },
  async getFirstAsync(sql) {
    calls.push({ type: 'first', sql });
    return {
      workoutRemindersEnabled: 1,
      workoutReminderTime: '07:30',
      missedWorkoutEnabled: 1,
      missedWorkoutTime: '21:00',
      unfinishedSessionEnabled: 0,
      deloadRemindersEnabled: 1,
      testWeekRemindersEnabled: 1,
    };
  },
  async getAllAsync(sql, limit) {
    calls.push({ type: 'all', sql, limit });
    return [
      {
        id: 'workout_due_2026-01-01T07:30:00_app',
        type: 'workout_due',
        scheduledFor: '2026-01-01T07:30:00',
        title: 'Training session due',
        body: 'Day 1',
        route: 'today',
        status: 'scheduled',
        externalNotificationId: 'native_1',
      },
    ];
  },
};

assert.equal((await getNotificationSettings(db)).unfinishedSessionEnabled, false);
assert.match(calls[0].sql, /INSERT OR IGNORE INTO notification_settings/);

await saveNotificationSettings(db, {
  workoutRemindersEnabled: false,
  workoutReminderTime: null,
  missedWorkoutEnabled: false,
  missedWorkoutTime: '21:00',
  unfinishedSessionEnabled: true,
  deloadRemindersEnabled: false,
  testWeekRemindersEnabled: false,
});
assert.equal(calls[2].params[1], 0);
assert.equal(calls[2].params[3], 0);
assert.equal(calls[2].params[6], 0);
assert.equal(calls[2].params[7], 0);

const id = await savePlannedNotification(
  db,
  {
    type: 'workout_due',
    scheduledFor: '2026-01-01T07:30:00',
    title: 'Training session due',
    body: 'Day 1',
    route: 'today',
  },
  'instance_1',
  'native_1',
);
assert.equal(id, 'workout_due_2026-01-01T07:30:00_instance_1');
assert.match(calls[3].sql, /INSERT OR REPLACE INTO scheduled_notifications/);
assert.equal(calls[3].params[8], 'native_1');

const scheduled = await getScheduledNotifications(db, 5);
assert.equal(scheduled[0].type, 'workout_due');
assert.equal(scheduled[0].route, 'today');
assert.equal(scheduled[0].externalNotificationId, 'native_1');
assert.equal(calls[4].limit, 5);
assert.match(calls[4].sql, /WHERE status = 'scheduled'/);
assert.match(calls[4].sql, /external_notification_id AS externalNotificationId/);
assert.match(calls[4].sql, /END AS route/);

const restId = await savePlannedNotification(
  db,
  {
    type: 'rest_timer',
    scheduledFor: '2026-01-01T10:04:00',
    title: 'Rest complete',
    body: 'Back Squat: begin the next set when ready.',
    route: 'today',
  },
  'set_1',
  'native_rest_1',
);
assert.equal(restId, 'rest_timer_2026-01-01T10:04:00_set_1');

console.log('notification queries verified');
