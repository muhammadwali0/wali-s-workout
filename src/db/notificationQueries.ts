import type {
  NotificationSettings,
  PlannedNotification,
} from '../domain/notifications/notificationPlanner.ts';
import type { TrainingDatabase } from './database.ts';

const settingsId = 'default';

export type ScheduledNotificationItem = PlannedNotification & {
  id: string;
  status: 'scheduled' | 'sent' | 'cancelled';
  externalNotificationId: string | null;
};

type NotificationSettingsRow = {
  workoutRemindersEnabled: number;
  workoutReminderTime: string | null;
  missedWorkoutEnabled: number;
  missedWorkoutTime: string | null;
  unfinishedSessionEnabled: number;
  deloadRemindersEnabled: number;
  testWeekRemindersEnabled: number;
};

const defaultNotificationSettings: NotificationSettings = {
  workoutRemindersEnabled: true,
  workoutReminderTime: '07:30',
  missedWorkoutEnabled: true,
  missedWorkoutTime: '21:00',
  unfinishedSessionEnabled: true,
  deloadRemindersEnabled: true,
  testWeekRemindersEnabled: true,
};

export async function getNotificationSettings(
  db: Pick<TrainingDatabase, 'getFirstAsync' | 'runAsync'>,
): Promise<NotificationSettings> {
  await ensureNotificationSettings(db);
  const row = await db.getFirstAsync<NotificationSettingsRow>(
    `SELECT
       workout_reminders_enabled AS workoutRemindersEnabled,
       workout_reminder_time AS workoutReminderTime,
       missed_workout_enabled AS missedWorkoutEnabled,
       missed_workout_time AS missedWorkoutTime,
       unfinished_session_enabled AS unfinishedSessionEnabled,
       deload_reminders_enabled AS deloadRemindersEnabled,
       test_week_reminders_enabled AS testWeekRemindersEnabled
     FROM notification_settings
     WHERE id = ?`,
    settingsId,
  );

  if (!row) return defaultNotificationSettings;
  return {
    workoutRemindersEnabled: row.workoutRemindersEnabled === 1,
    workoutReminderTime: row.workoutReminderTime,
    missedWorkoutEnabled: row.missedWorkoutEnabled === 1,
    missedWorkoutTime: row.missedWorkoutTime,
    unfinishedSessionEnabled: row.unfinishedSessionEnabled === 1,
    deloadRemindersEnabled: row.deloadRemindersEnabled === 1,
    testWeekRemindersEnabled: row.testWeekRemindersEnabled === 1,
  };
}

export async function saveNotificationSettings(
  db: Pick<TrainingDatabase, 'runAsync'>,
  settings: NotificationSettings,
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO notification_settings (
       id,
       workout_reminders_enabled,
       workout_reminder_time,
       missed_workout_enabled,
       missed_workout_time,
       unfinished_session_enabled,
       deload_reminders_enabled,
       test_week_reminders_enabled,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    settingsId,
    settings.workoutRemindersEnabled ? 1 : 0,
    settings.workoutReminderTime,
    settings.missedWorkoutEnabled ? 1 : 0,
    settings.missedWorkoutTime,
    settings.unfinishedSessionEnabled ? 1 : 0,
    settings.deloadRemindersEnabled ? 1 : 0,
    settings.testWeekRemindersEnabled ? 1 : 0,
    now,
    now,
  );
}

export async function savePlannedNotification(
  db: Pick<TrainingDatabase, 'runAsync'>,
  notification: PlannedNotification,
  relatedEntityId: string | null = null,
  externalNotificationId: string | null = null,
) {
  const now = new Date().toISOString();
  const id = `${notification.type}_${notification.scheduledFor}_${relatedEntityId ?? 'app'}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO scheduled_notifications (
       id,
       notification_type,
       related_entity_type,
       related_entity_id,
       scheduled_for,
       title,
       body,
       status,
       external_notification_id,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    notification.type,
    relatedEntityId ? 'workout_instance' : null,
    relatedEntityId,
    notification.scheduledFor,
    notification.title,
    notification.body,
    'scheduled',
    externalNotificationId,
    now,
    now,
  );
  return id;
}

export async function getScheduledNotifications(
  db: Pick<TrainingDatabase, 'getAllAsync'>,
  limit = 10,
): Promise<ScheduledNotificationItem[]> {
  return db.getAllAsync<ScheduledNotificationItem>(
    `SELECT
       id,
       notification_type AS type,
       scheduled_for AS scheduledFor,
       title,
       body,
       status,
       external_notification_id AS externalNotificationId
     FROM scheduled_notifications
     WHERE status = 'scheduled'
     ORDER BY scheduled_for
     LIMIT ?`,
    limit,
  );
}

async function ensureNotificationSettings(db: Pick<TrainingDatabase, 'runAsync'>) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO notification_settings (
       id,
       workout_reminders_enabled,
       workout_reminder_time,
       missed_workout_enabled,
       missed_workout_time,
       unfinished_session_enabled,
       deload_reminders_enabled,
       test_week_reminders_enabled,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    settingsId,
    defaultNotificationSettings.workoutRemindersEnabled ? 1 : 0,
    defaultNotificationSettings.workoutReminderTime,
    defaultNotificationSettings.missedWorkoutEnabled ? 1 : 0,
    defaultNotificationSettings.missedWorkoutTime,
    defaultNotificationSettings.unfinishedSessionEnabled ? 1 : 0,
    defaultNotificationSettings.deloadRemindersEnabled ? 1 : 0,
    defaultNotificationSettings.testWeekRemindersEnabled ? 1 : 0,
    now,
    now,
  );
}
