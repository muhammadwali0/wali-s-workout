import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getCalendarWorkouts,
  getCompletedAnalyticsSets,
  getEstimatedOneRmTrend,
  type AnalyticsSet,
  type StrengthTrendPoint,
} from './db/analyticsQueries';
import {
  getExerciseAlternatives,
  type ExerciseAlternativeItem,
} from './db/alternativeQueries';
import { openTrainingDatabase, type TrainingDatabase } from './db/database';
import {
  getTodayWorkoutInstance,
  type TodayWorkoutInstance,
} from './db/todayWorkoutQuery';
import {
  getRecentWorkoutHistory,
  type WorkoutHistoryItem,
} from './db/historyQueries';
import {
  getExerciseLibrary,
  type ExerciseLibraryItem,
} from './db/libraryQueries';
import {
  getCurrentOneRmRecords,
  saveOneRmRecord,
  type CurrentOneRmRecord,
} from './db/oneRmQueries';
import {
  getNotificationSettings,
  getScheduledNotifications,
  saveNotificationSettings,
  savePlannedNotification,
  type ScheduledNotificationItem,
} from './db/notificationQueries';
import {
  getRecentPersonalRecords,
  type PersonalRecordItem,
} from './db/personalRecordQueries';
import {
  getMissedWorkoutInstances,
  markOverdueWorkoutsMissed,
  resolveMissedWorkoutInstance,
  type MissedWorkoutItem,
} from './db/missedWorkoutQueries';
import {
  getActiveExerciseReplacements,
  restoreExerciseReplacement,
  saveExerciseReplacement,
  type ActiveExerciseReplacement,
} from './db/modificationQueries';
import { getAppSettings, saveAppSettings } from './db/settingsQueries';
import { saveWorkoutDraft } from './db/workoutLogPersistence';
import { getSavedWorkoutDraft } from './db/workoutDraftQuery';
import {
  getConsistencyCalendar,
  type CalendarWorkout,
} from './domain/analytics/consistencyCalendar';
import { calculateMuscleExposure } from './domain/analytics/muscleExposure';
import { getWeeklyVolume } from './domain/analytics/weeklyVolume';
import { programSeed } from './data/programSeed';
import {
  createTrainingYear,
  formatProgramPosition,
  getProgramPosition,
  type ProgramPosition,
} from './domain/program/yearEngine';
import {
  planWorkoutDueNotification,
  type NotificationSettings,
} from './domain/notifications/notificationPlanner';
import { defaultSettings, type AppSettings } from './domain/settings/appSettings';
import { getSuggestedLoad } from './domain/load/suggestedLoad';
import { getDueWorkout } from './domain/program/seedResolver';
import {
  applyExerciseReplacements,
  createPlannedSets,
} from './domain/workout/sessionPlanner';
import {
  completeSet,
  completeWorkout,
  createWorkoutDraft,
  summarizeWorkoutDraft,
  type WorkoutDraft,
} from './domain/workout/workoutLog';
import {
  createRestTimer,
  getRestTimerState,
  type RestTimer,
} from './domain/workout/restTimer';

type TabKey = 'today' | 'year' | 'analytics' | 'history' | 'library';

type Tab = {
  key: TabKey;
  label: string;
  title: string;
  eyebrow: string;
  body: string;
};

const tabs: Tab[] = [
  {
    key: 'today',
    label: 'Today',
    title: 'Training Session Due',
    eyebrow: 'Block position pending seed import',
    body: 'The Today view will resolve the active program day, workout status, main lifts, prior session, and next scheduled workout.',
  },
  {
    key: 'year',
    label: 'Year',
    title: 'Annual Structure',
    eyebrow: '52-week sequence',
    body: 'The Year view will show blocks, weeks, rest days, buffer periods, deloads, testing weeks, and rescheduled sessions.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    title: 'Training Evidence',
    eyebrow: 'Charts require logged sets',
    body: 'Analytics will derive adherence, volume, strength, frequency, and muscle distribution from stored workout data.',
  },
  {
    key: 'history',
    label: 'History',
    title: 'Completed Workouts',
    eyebrow: 'Actual performance stays separate',
    body: 'History will preserve performed sets, session notes, duration, PRs, and planned-versus-actual differences.',
  },
  {
    key: 'library',
    label: 'Library',
    title: 'Exercise and Settings Vault',
    eyebrow: 'Program metadata',
    body: 'Library will hold exercises, muscles, faithful alternatives, 1RM records, units, reminders, and data controls.',
  },
];

const muscleNameById: Map<string, string> = new Map(
  programSeed.muscles.map((muscle) => [muscle.id, muscle.name]),
);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [db, setDb] = useState<TrainingDatabase | null>(null);
  const [todayInstance, setTodayInstance] = useState<TodayWorkoutInstance | null>(
    null,
  );
  const [analyticsSets, setAnalyticsSets] = useState<AnalyticsSet[]>([]);
  const [strengthTrend, setStrengthTrend] = useState<StrengthTrendPoint[]>([]);
  const [calendarWorkouts, setCalendarWorkouts] = useState<CalendarWorkout[]>([]);
  const [historyItems, setHistoryItems] = useState<WorkoutHistoryItem[]>([]);
  const [libraryExercises, setLibraryExercises] = useState<ExerciseLibraryItem[]>(
    [],
  );
  const [oneRmRecords, setOneRmRecords] = useState<CurrentOneRmRecord[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [exerciseAlternatives, setExerciseAlternatives] = useState<
    ExerciseAlternativeItem[]
  >([]);
  const [activeReplacements, setActiveReplacements] = useState<
    ActiveExerciseReplacement[]
  >([]);
  const [missedWorkouts, setMissedWorkouts] = useState<MissedWorkoutItem[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecordItem[]>(
    [],
  );
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      workoutRemindersEnabled: true,
      workoutReminderTime: '07:30',
      missedWorkoutEnabled: true,
      missedWorkoutTime: '21:00',
      unfinishedSessionEnabled: true,
      deloadRemindersEnabled: true,
      testWeekRemindersEnabled: true,
    });
  const [scheduledNotifications, setScheduledNotifications] = useState<
    ScheduledNotificationItem[]
  >([]);
  const [dbStatus, setDbStatus] = useState('Opening local database');
  const trainingYear = useMemo(() => {
    const now = new Date();
    return createTrainingYear(
      new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
    );
  }, []);
  const position = useMemo(
    () => getProgramPosition(new Date(), trainingYear),
    [trainingYear],
  );
  const dueWorkout = useMemo(() => getDueWorkout(position), [position]);
  const active = useMemo(
    () => tabs.find((tab) => tab.key === activeTab) ?? tabs[0],
    [activeTab],
  );
  const positionLabel = formatProgramPosition(position);
  const weekType =
    position.status === 'in_year' ? position.week.weekType : position.status;
  const refreshLocalData = async (database: TrainingDatabase) => {
    await markOverdueWorkoutsMissed(database);
    setTodayInstance(await getTodayWorkoutInstance(database));
    setAnalyticsSets(await getCompletedAnalyticsSets(database));
    setStrengthTrend(await getEstimatedOneRmTrend(database));
    setCalendarWorkouts(await getCalendarWorkouts(database));
    setHistoryItems(await getRecentWorkoutHistory(database));
    setLibraryExercises(await getExerciseLibrary(database));
    setOneRmRecords(await getCurrentOneRmRecords(database));
    setAppSettings(await getAppSettings(database));
    setExerciseAlternatives(await getExerciseAlternatives(database));
    setActiveReplacements(await getActiveExerciseReplacements(database));
    setMissedWorkouts(await getMissedWorkoutInstances(database));
    setPersonalRecords(await getRecentPersonalRecords(database));
    setNotificationSettings(await getNotificationSettings(database));
    setScheduledNotifications(await getScheduledNotifications(database));
  };

  useEffect(() => {
    let cancelled = false;

    openTrainingDatabase()
      .then(async (database) => {
        if (cancelled) return;
        setDb(database);
        await refreshLocalData(database);
        setDbStatus('Local database ready');
      })
      .catch(() => {
        if (!cancelled) setDbStatus('Local database unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <Text style={styles.appName}>Wali's Workout</Text>
          <Text style={styles.dateText}>Structured Training Logbook</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.positionCard}>
            <Text style={styles.meta}>Current Workspace</Text>
            <Text style={styles.positionTitle}>
              {activeTab === 'today' ? positionLabel : active.title}
            </Text>
            <Text style={styles.eyebrow}>
              {activeTab === 'today' ? `Week type: ${weekType}` : active.eyebrow}
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'today' ? getTodayTitle(dueWorkout) : active.label}
            </Text>
            <Text style={styles.body}>{active.body}</Text>
            {activeTab === 'today' ? (
              <TodayWorkoutSummary
                db={db}
                dbReady={db !== null}
                dbStatus={dbStatus}
                activeReplacements={activeReplacements}
                appSettings={appSettings}
                dueWorkout={dueWorkout}
                onSaved={refreshLocalData}
                oneRmRecords={oneRmRecords}
                todayInstance={todayInstance}
              />
            ) : null}
            {activeTab === 'analytics' ? (
              <AnalyticsSummary
                calendarWorkouts={calendarWorkouts}
                completedSets={analyticsSets}
                dbStatus={dbStatus}
                strengthTrend={strengthTrend}
              />
            ) : null}
            {activeTab === 'history' ? (
              <HistorySummary
                dbStatus={dbStatus}
                historyItems={historyItems}
                personalRecords={personalRecords}
              />
            ) : null}
            {activeTab === 'year' ? (
              <YearSummary
                calendarWorkouts={calendarWorkouts}
                db={db}
                dbStatus={dbStatus}
                missedWorkouts={missedWorkouts}
                onSaved={refreshLocalData}
              />
            ) : null}
            {activeTab === 'library' ? (
              <LibrarySummary
                db={db}
                appSettings={appSettings}
                dbStatus={dbStatus}
                exerciseAlternatives={exerciseAlternatives}
                exercises={libraryExercises}
                activeReplacements={activeReplacements}
                dueWorkout={dueWorkout}
                notificationSettings={notificationSettings}
                onSaved={refreshLocalData}
                oneRmRecords={oneRmRecords}
                position={position}
                scheduledNotifications={scheduledNotifications}
              />
            ) : null}
          </View>

          <View style={styles.metricsRow}>
            <Metric label="Program" value="52 weeks" />
            <Metric label="Mode" value="Offline" />
            <Metric label="Data" value="Local" />
          </View>
        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, selected && styles.activeTab]}
              >
                <Text style={[styles.tabText, selected && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function TodayWorkoutSummary({
  db,
  dbReady,
  dbStatus,
  activeReplacements,
  appSettings,
  dueWorkout,
  onSaved,
  oneRmRecords,
  todayInstance,
}: {
  db: TrainingDatabase | null;
  dbReady: boolean;
  dbStatus: string;
  activeReplacements: ActiveExerciseReplacement[];
  appSettings: AppSettings;
  dueWorkout: ReturnType<typeof getDueWorkout>;
  onSaved: (database: TrainingDatabase) => Promise<void>;
  oneRmRecords: CurrentOneRmRecord[];
  todayInstance: TodayWorkoutInstance | null;
}) {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(Date.now());
  const [saveStatus, setSaveStatus] = useState('Not saved');

  useEffect(() => {
    setDraft(null);
    setRestTimer(null);
  }, [dueWorkout.status === 'workout_due' ? dueWorkout.workout.id : dueWorkout.status]);

  useEffect(() => {
    if (!db || !todayInstance || dueWorkout.status !== 'workout_due') return;

    const plannedSets = applyExerciseReplacements(
      createPlannedSets(dueWorkout.workout),
      activeReplacements,
    );
    void getSavedWorkoutDraft(
      db,
      todayInstance.instanceId,
      dueWorkout.workout.id,
      plannedSets,
    ).then((savedDraft) => {
      if (savedDraft) {
        setDraft(savedDraft);
        setSaveStatus('Recovered saved workout');
      }
    });
  }, [
    activeReplacements,
    db,
    dueWorkout.status === 'workout_due' ? dueWorkout.workout.id : dueWorkout.status,
    todayInstance,
  ]);

  useEffect(() => {
    if (!restTimer) return;

    const id = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [restTimer]);

  if (dueWorkout.status === 'workout_due') {
    const plannedSets = applyExerciseReplacements(
      createPlannedSets(dueWorkout.workout),
      activeReplacements,
    );
    const previewSets = plannedSets.slice(0, 5);
    const summary = draft ? summarizeWorkoutDraft(draft) : null;
    const nextSet = draft?.actualSets.find((set) => !set.completed);
    const timerState = restTimer
      ? getRestTimerState(restTimer, timerNowMs)
      : null;
    const saveDraft = async (nextDraft: WorkoutDraft) => {
      setDraft(nextDraft);
      if (!db || !todayInstance) return;

      await saveWorkoutDraft(db, nextDraft, {
        workoutLogId: `${todayInstance.instanceId}_log`,
        workoutInstanceId: todayInstance.instanceId,
        recordedAt: new Date().toISOString(),
        unit: appSettings.preferredUnit,
      });
      await onSaved(db);
      setSaveStatus('Saved locally');
    };

    return (
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryTitle}>{dueWorkout.workout.name}</Text>
        <Text style={styles.summaryText}>
          {dbStatus}
          {todayInstance
            ? ` - ${todayInstance.status} - ${todayInstance.instanceId}`
            : dbReady
              ? ' - no persisted instance for today'
              : ''}
        </Text>
        <Text style={styles.summaryText}>{saveStatus}</Text>
        <Text style={styles.summaryText}>
          {dueWorkout.workout.estimatedDurationMin ?? 0} min -{' '}
          {dueWorkout.workout.exercises.length} exercises - {plannedSets.length} planned sets
        </Text>
        <Text style={styles.summaryText}>
          Main lifts: {dueWorkout.mainLifts.join(', ')}
        </Text>
        <View style={styles.sessionPanel}>
          <Text style={styles.sessionTitle}>Workout Execution</Text>
          <Text style={styles.summaryText}>
            {summary
              ? `${summary.completedSets}/${summary.plannedSets} sets - ${summary.totalVolume} kg reps`
              : 'No active local draft'}
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void saveDraft(
                  createWorkoutDraft(dueWorkout.workout.id, plannedSets),
                )
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {draft ? 'Restart' : 'Start'}
              </Text>
            </Pressable>
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const plannedSet = plannedSets.find(
                    (set) => set.id === nextSet.plannedSetId,
                  );
                  const suggestion = plannedSet
                    ? getSuggestedLoad(
                        plannedSet,
                        oneRmRecords,
                        appSettings.plateIncrement,
                      )
                    : null;

                  if (plannedSet) {
                    setRestTimer(createRestTimer(plannedSet, Date.now()));
                    setTimerNowMs(Date.now());
                  }
                  void saveDraft(
                    completeSet(draft, nextSet.plannedSetId, {
                      weight: suggestion?.roundedLow ?? 0,
                      reps: getDefaultReps(plannedSet?.targetReps ?? null),
                      rpe: plannedSet?.targetRpeHigh ?? null,
                    }),
                  );
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Log Next Set</Text>
              </Pressable>
            ) : null}
            {draft && summary?.isComplete && draft.status !== 'completed' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveDraft(completeWorkout(draft))}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Finish</Text>
              </Pressable>
            ) : null}
          </View>
          {draft ? (
            <Text style={styles.currentSetText}>
              {nextSet
                ? `Next: ${
                    plannedSets.find((set) => set.id === nextSet.plannedSetId)
                      ?.exerciseName ?? 'Set'
                  }`
                : draft.status === 'completed'
                  ? 'Workout completed'
                  : 'All sets logged'}
            </Text>
          ) : null}
          {timerState && restTimer ? (
            <Text style={styles.currentSetText}>
              Rest: {formatDuration(timerState.remainingSeconds)}
              {timerState.isComplete ? ' complete' : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.setPreview}>
          {previewSets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setExercise}>{set.exerciseName}</Text>
              {set.substitutionScope ? (
                <Text style={styles.setPrescription}>
                  Original: {set.originalExerciseName} - {set.substitutionScope}
                </Text>
              ) : null}
              <Text style={styles.setPrescription}>
                Set {set.setNumber} - {set.setType}
                {set.targetReps ? ` - ${set.targetReps} reps` : ''}
                {formatPercentRange(set.percent1RmLow, set.percent1RmHigh)}
                {formatSuggestedLoad(
                  getSuggestedLoad(set, oneRmRecords, appSettings.plateIncrement),
                  appSettings.preferredUnit,
                )}
                {formatRpeRange(set.targetRpeLow, set.targetRpeHigh)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (dueWorkout.status === 'rest_day') {
    return (
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryTitle}>Rest Day</Text>
        <Text style={styles.summaryText}>
          Next session: {dueWorkout.nextWorkout?.name ?? 'No later session this week'}
        </Text>
      </View>
    );
  }

  if (dueWorkout.status === 'buffer_week') {
    return (
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryTitle}>Buffer Week</Text>
        <Text style={styles.summaryText}>No training is prescribed for this week.</Text>
      </View>
    );
  }

  return null;
}

function AnalyticsSummary({
  calendarWorkouts,
  completedSets,
  dbStatus,
  strengthTrend,
}: {
  calendarWorkouts: CalendarWorkout[];
  completedSets: AnalyticsSet[];
  dbStatus: string;
  strengthTrend: StrengthTrendPoint[];
}) {
  const weeklyVolume = getWeeklyVolume(completedSets);
  const consistency = getConsistencyCalendar(calendarWorkouts);
  const muscleExposure = calculateMuscleExposure(completedSets)
    .sort((a, b) => b.volumeLoad - a.volumeLoad)
    .slice(0, 5);
  const maxVolume = Math.max(...weeklyVolume.map((point) => point.totalVolume), 1);
  const maxExposure = Math.max(
    ...muscleExposure.map((exposure) => exposure.volumeLoad),
    1,
  );
  const completed = consistency.reduce((sum, day) => sum + day.completed, 0);
  const missed = consistency.reduce((sum, day) => sum + day.missed, 0);

  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Analytics Preview</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {completedSets.length} completed sets available.
      </Text>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Weekly Volume</Text>
        {weeklyVolume.length === 0 ? (
          <Text style={styles.summaryText}>No completed working sets yet.</Text>
        ) : (
          weeklyVolume.map((point) => (
            <BarRow
              key={point.weekKey}
              label={point.weekKey}
              value={`${point.totalVolume} kg reps`}
              percent={(point.totalVolume / maxVolume) * 100}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Muscle Exposure</Text>
        {muscleExposure.length === 0 ? (
          <Text style={styles.summaryText}>No muscle exposure from completed sets yet.</Text>
        ) : (
          muscleExposure.map((exposure) => (
            <BarRow
              key={exposure.muscleId}
              label={muscleNameById.get(exposure.muscleId) ?? exposure.muscleId}
              value={`${exposure.hardSets.toFixed(1)} hard sets`}
              percent={(exposure.volumeLoad / maxExposure) * 100}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Estimated 1RM Trend</Text>
        {strengthTrend.length === 0 ? (
          <Text style={styles.summaryText}>No estimated 1RM records yet.</Text>
        ) : (
          strengthTrend.slice(0, 5).map((point) => (
            <View key={`${point.exerciseId}_${point.achievedAt}`} style={styles.setRow}>
              <Text style={styles.setExercise}>{point.exerciseName}</Text>
              <Text style={styles.setPrescription}>
                {Math.round(point.estimatedOneRm * 10) / 10} {point.unit ?? ''} -{' '}
                {point.achievedAt}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.analyticsFooter}>
        <Metric label="Completed" value={String(completed)} />
        <Metric label="Missed" value={String(missed)} />
      </View>
    </View>
  );
}

function HistorySummary({
  dbStatus,
  historyItems,
  personalRecords,
}: {
  dbStatus: string;
  historyItems: WorkoutHistoryItem[];
  personalRecords: PersonalRecordItem[];
}) {
  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Recent Workout Logs</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {historyItems.length} logs available.
      </Text>
      <View style={styles.setPreview}>
        {historyItems.length === 0 ? (
          <Text style={styles.summaryText}>No saved workout logs yet.</Text>
        ) : (
          historyItems.map((item) => (
            <View key={item.workoutLogId} style={styles.setRow}>
              <Text style={styles.setExercise}>{item.workoutName}</Text>
              <Text style={styles.setPrescription}>
                {item.status} - {item.completedAt ?? item.scheduledDate} -{' '}
                {item.totalWorkingSets ?? 0} working sets - {item.totalVolume ?? 0} kg reps
              </Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.baselinePanel}>
        <Text style={styles.summaryTitle}>Personal Records</Text>
        {personalRecords.length === 0 ? (
          <Text style={styles.summaryText}>No personal records saved yet.</Text>
        ) : (
          personalRecords.map((record) => (
            <View key={record.recordId} style={styles.setRow}>
              <Text style={styles.setExercise}>{record.exerciseName}</Text>
              <Text style={styles.setPrescription}>
                {formatPersonalRecord(record)} - {record.achievedAt}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function YearSummary({
  calendarWorkouts,
  db,
  dbStatus,
  missedWorkouts,
  onSaved,
}: {
  calendarWorkouts: CalendarWorkout[];
  db: TrainingDatabase | null;
  dbStatus: string;
  missedWorkouts: MissedWorkoutItem[];
  onSaved: (database: TrainingDatabase) => Promise<void>;
}) {
  const [status, setStatus] = useState('No schedule change selected');
  const completed = calendarWorkouts.filter(
    (workout) => workout.status === 'completed',
  ).length;
  const skipped = calendarWorkouts.filter(
    (workout) => workout.status === 'skipped',
  ).length;
  const rescheduled = calendarWorkouts.filter(
    (workout) => workout.status === 'rescheduled',
  ).length;
  const resolve = async (
    workout: MissedWorkoutItem,
    action: 'skip' | 'do_today_and_shift',
  ) => {
    if (!db) return;

    await resolveMissedWorkoutInstance(
      db,
      workout.instanceId,
      action === 'skip'
        ? { action, reason: 'Skipped from Year view' }
        : { action, today: new Date().toISOString().slice(0, 10) },
    );
    await onSaved(db);
    setStatus(action === 'skip' ? 'Workout skipped' : 'Workout moved to today');
  };

  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Missed Sessions</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {missedWorkouts.length} unresolved missed workouts.
      </Text>
      <Text style={styles.summaryText}>{status}</Text>
      <View style={styles.analyticsFooter}>
        <Metric label="Completed" value={String(completed)} />
        <Metric label="Skipped" value={String(skipped)} />
        <Metric label="Moved" value={String(rescheduled)} />
      </View>
      <View style={styles.setPreview}>
        {missedWorkouts.length === 0 ? (
          <Text style={styles.summaryText}>No missed sessions need a decision.</Text>
        ) : (
          missedWorkouts.map((workout) => (
            <View key={workout.instanceId} style={styles.setRow}>
              <Text style={styles.setExercise}>{workout.workoutName}</Text>
              <Text style={styles.setPrescription}>
                {workout.scheduledDate} - {workout.status}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void resolve(workout, 'do_today_and_shift')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Do Today</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void resolve(workout, 'skip')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Skip</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function LibrarySummary({
  appSettings,
  db,
  dbStatus,
  dueWorkout,
  exerciseAlternatives,
  exercises,
  activeReplacements,
  notificationSettings,
  onSaved,
  oneRmRecords,
  position,
  scheduledNotifications,
}: {
  appSettings: AppSettings;
  db: TrainingDatabase | null;
  dbStatus: string;
  dueWorkout: ReturnType<typeof getDueWorkout>;
  exerciseAlternatives: ExerciseAlternativeItem[];
  exercises: ExerciseLibraryItem[];
  activeReplacements: ActiveExerciseReplacement[];
  notificationSettings: NotificationSettings;
  onSaved: (database: TrainingDatabase) => Promise<void>;
  oneRmRecords: CurrentOneRmRecord[];
  position: ProgramPosition;
  scheduledNotifications: ScheduledNotificationItem[];
}) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftPlateIncrement, setDraftPlateIncrement] = useState('');
  const [saveStatus, setSaveStatus] = useState('Baselines not changed');
  const recordByExercise = new Map(
    oneRmRecords.map((record) => [record.exerciseId, record]),
  );
  const alternativesByExercise = new Map<string, ExerciseAlternativeItem[]>();
  for (const alternative of exerciseAlternatives) {
    alternativesByExercise.set(alternative.sourceExerciseId, [
      ...(alternativesByExercise.get(alternative.sourceExerciseId) ?? []),
      alternative,
    ]);
  }
  const replacementByExercise = new Map(
    activeReplacements.map((replacement) => [
      replacement.originalExerciseId,
      replacement,
    ]),
  );
  const baselineExercises = exercises.slice(0, 5);
  const saveBaseline = async (exerciseId: string) => {
    if (!db) return;

    const value = Number(draftValues[exerciseId]);
    if (!Number.isFinite(value) || value <= 0) {
      setSaveStatus('Enter a positive baseline');
      return;
    }

    await saveOneRmRecord(db, {
      exerciseId,
      value,
      unit: appSettings.preferredUnit,
    });
    await onSaved(db);
    setSaveStatus('Baseline saved locally');
  };
  const saveSettings = async (settings: Partial<AppSettings>) => {
    if (!db) return;

    if (
      settings.plateIncrement !== undefined &&
      (!Number.isFinite(settings.plateIncrement) || settings.plateIncrement <= 0)
    ) {
      setSaveStatus('Enter a positive increment');
      return;
    }

    await saveAppSettings(db, { ...appSettings, ...settings });
    await onSaved(db);
    setSaveStatus('Settings saved locally');
  };
  const saveReplacement = async (alternative: ExerciseAlternativeItem) => {
    if (!db) return;

    await saveExerciseReplacement(db, {
      originalExerciseId: alternative.sourceExerciseId,
      replacementExerciseId: alternative.alternativeExerciseId,
      scope: 'today_only',
    });
    await onSaved(db);
    setSaveStatus('Substitution saved for today');
  };
  const restoreReplacement = async (replacement: ActiveExerciseReplacement) => {
    if (!db) return;

    await restoreExerciseReplacement(db, replacement.id);
    await onSaved(db);
    setSaveStatus('Original exercise restored');
  };
  const toggleWorkoutReminder = async () => {
    if (!db) return;

    await saveNotificationSettings(db, {
      ...notificationSettings,
      workoutRemindersEnabled: !notificationSettings.workoutRemindersEnabled,
    });
    await onSaved(db);
    setSaveStatus('Notification settings saved');
  };
  const scheduleTodayReminder = async () => {
    if (!db) return;

    const notification = planWorkoutDueNotification(
      new Date().toISOString().slice(0, 10),
      position,
      dueWorkout,
      notificationSettings,
    );
    if (!notification) {
      setSaveStatus('No workout reminder due');
      return;
    }

    await savePlannedNotification(db, notification);
    await onSaved(db);
    setSaveStatus('Workout reminder scheduled');
  };

  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Exercise Library</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {exercises.length} exercises loaded.
      </Text>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Training Settings</Text>
        <Text style={styles.summaryText}>
          Unit: {appSettings.preferredUnit} - Plate increment:{' '}
          {appSettings.plateIncrement}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({
                preferredUnit: appSettings.preferredUnit === 'kg' ? 'lb' : 'kg',
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Unit</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Plate increment"
            inputMode="decimal"
            onChangeText={setDraftPlateIncrement}
            placeholder={String(appSettings.plateIncrement)}
            style={styles.baselineInput}
            value={draftPlateIncrement}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({
                plateIncrement: Number(
                  draftPlateIncrement || appSettings.plateIncrement,
                ),
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Save Increment</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Notifications</Text>
        <Text style={styles.summaryText}>
          Workout reminders: {notificationSettings.workoutRemindersEnabled ? 'on' : 'off'} -{' '}
          {notificationSettings.workoutReminderTime ?? 'unset'}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleWorkoutReminder()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Reminders</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void scheduleTodayReminder()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Schedule Today</Text>
          </Pressable>
        </View>
        {scheduledNotifications.slice(0, 3).map((notification) => (
          <Text key={notification.id} style={styles.setPrescription}>
            {notification.title} - {notification.scheduledFor}
          </Text>
        ))}
      </View>
      <View style={styles.setPreview}>
        {exercises.length === 0 ? (
          <Text style={styles.summaryText}>No seeded exercises available.</Text>
        ) : (
          exercises.map((exercise) => (
            <View key={exercise.exerciseId} style={styles.setRow}>
              <Text style={styles.setExercise}>{exercise.name}</Text>
              <Text style={styles.setPrescription}>
                {exercise.movementPattern} - {exercise.defaultRole ?? 'general'} -{' '}
                {exercise.primaryMuscles ?? 'No primary muscle'} -{' '}
                {exercise.alternativeCount} alternatives
              </Text>
              {replacementByExercise.has(exercise.exerciseId) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const replacement = replacementByExercise.get(
                      exercise.exerciseId,
                    );
                    if (replacement) void restoreReplacement(replacement);
                  }}
                >
                  <Text style={styles.setPrescription}>
                    Current: {
                      replacementByExercise.get(exercise.exerciseId)?.replacementName
                    } -{' '}
                    {replacementByExercise.get(exercise.exerciseId)?.scope} - restore
                  </Text>
                </Pressable>
              ) : null}
              {(alternativesByExercise.get(exercise.exerciseId) ?? [])
                .slice(0, 2)
                .map((alternative) => (
                  <Pressable
                    accessibilityRole="button"
                    key={alternative.alternativeExerciseId}
                    onPress={() => void saveReplacement(alternative)}
                  >
                    <Text style={styles.setPrescription}>
                      Substitute: {alternative.alternativeName} -{' '}
                      {alternative.compatibilityScore}% match
                    </Text>
                  </Pressable>
                ))}
            </View>
          ))
        )}
      </View>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Current Working 1RM</Text>
        <Text style={styles.summaryText}>{saveStatus}</Text>
        {baselineExercises.map((exercise) => {
          const record = recordByExercise.get(exercise.exerciseId);

          return (
            <View key={exercise.exerciseId} style={styles.baselineRow}>
              <View style={styles.baselineLabel}>
                <Text style={styles.setExercise}>{exercise.name}</Text>
                <Text style={styles.setPrescription}>
                  {record ? `${record.value} ${record.unit}` : 'No baseline saved'}
                </Text>
              </View>
              <TextInput
                accessibilityLabel={`Current working 1RM for ${exercise.name}`}
                inputMode="decimal"
                onChangeText={(value) =>
                  setDraftValues((current) => ({
                    ...current,
                    [exercise.exerciseId]: value,
                  }))
                }
                placeholder={appSettings.preferredUnit}
                style={styles.baselineInput}
                value={draftValues[exercise.exerciseId] ?? ''}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveBaseline(exercise.exerciseId)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Save</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BarRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(percent, 4)}%` }]} />
      </View>
    </View>
  );
}

function getTodayTitle(dueWorkout: ReturnType<typeof getDueWorkout>) {
  if (dueWorkout.status === 'workout_due') return 'Workout Due';
  if (dueWorkout.status === 'rest_day') return 'Rest Day';
  if (dueWorkout.status === 'buffer_week') return 'Buffer Week';
  return 'Training Year';
}

function formatPercentRange(low: number | null, high: number | null) {
  if (low === null && high === null) return '';
  if (low === high) return ` - ${low}%`;
  return ` - ${low ?? high}-${high ?? low}%`;
}

function formatRpeRange(low: number | null, high: number | null) {
  if (low === null && high === null) return '';
  if (low === high) return ` - RPE ${low}`;
  return ` - RPE ${low ?? high}-${high ?? low}`;
}

function formatSuggestedLoad(
  load: ReturnType<typeof getSuggestedLoad>,
  unit: AppSettings['preferredUnit'],
) {
  if (!load) return '';
  if (load.roundedLow === load.roundedHigh) return ` - ${load.roundedLow} ${unit}`;
  return ` - ${load.roundedLow}-${load.roundedHigh} ${unit}`;
}

function formatPersonalRecord(record: PersonalRecordItem) {
  if (record.prType === 'max_weight') {
    return `Max weight ${record.weight ?? 0} ${record.unit ?? ''}`.trim();
  }
  if (record.prType === 'rep_pr') {
    return `${record.reps ?? 0} reps at ${record.weight ?? 0} ${record.unit ?? ''}`.trim();
  }
  if (record.prType === 'estimated_1rm') {
    return `Estimated 1RM ${Math.round((record.estimatedOneRm ?? 0) * 10) / 10} ${
      record.unit ?? ''
    }`.trim();
  }
  return `Volume ${record.volume ?? 0} ${record.unit ?? ''} reps`.trim();
}

function getDefaultReps(targetReps: string | null) {
  const match = targetReps?.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  shell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  appName: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
  },
  dateText: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    gap: 16,
    padding: 20,
  },
  positionCard: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  meta: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  positionTitle: {
    marginTop: 10,
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
  },
  eyebrow: {
    marginTop: 8,
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    marginTop: 10,
    color: '#334155',
    fontSize: 15,
    lineHeight: 23,
  },
  summaryBlock: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
  },
  summaryTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    marginTop: 6,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  setPreview: {
    marginTop: 14,
    gap: 8,
  },
  sessionPanel: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  sessionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  baselinePanel: {
    marginTop: 16,
    gap: 10,
  },
  baselineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  baselineLabel: {
    flex: 1,
  },
  baselineInput: {
    minHeight: 42,
    minWidth: 76,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  primaryButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 14,
    backgroundColor: '#1E3A5F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderRadius: 6,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '700',
  },
  currentSetText: {
    marginTop: 10,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  setRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#1E3A5F',
    paddingLeft: 10,
  },
  setExercise: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  setPrescription: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: 6,
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 4,
  },
  activeTab: {
    borderTopWidth: 3,
    borderTopColor: '#1E3A5F',
  },
  tabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#1E3A5F',
  },
  analyticsSection: {
    marginTop: 16,
    gap: 10,
  },
  analyticsHeading: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  barRow: {
    gap: 6,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  barLabel: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  barValue: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E3A5F',
  },
  analyticsFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
