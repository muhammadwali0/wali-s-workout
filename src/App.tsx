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
  getLatestExercisePerformances,
  getNextWorkoutInstance,
  getTodayWorkoutInstance,
  type LatestExercisePerformance,
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
  type ExerciseReplacementInput,
} from './db/modificationQueries';
import { getAppSettings, saveAppSettings } from './db/settingsQueries';
import { saveWorkoutDraft } from './db/workoutLogPersistence';
import { getSavedWorkoutDraft } from './db/workoutDraftQuery';
import {
  getConsistencyCalendar,
  type CalendarWorkout,
} from './domain/analytics/consistencyCalendar';
import { compareBlocks, comparePhases } from './domain/analytics/blockComparison';
import { calculateMuscleExposure } from './domain/analytics/muscleExposure';
import {
  calculateMuscleHeatmap,
  type MuscleHeatmapRegion,
} from './domain/analytics/muscleHeatmap';
import { getTrainingFrequency } from './domain/analytics/trainingFrequency';
import { getWeeklyAverageRpe } from './domain/analytics/weeklyRpe';
import { getWeeklyVolume } from './domain/analytics/weeklyVolume';
import { programSeed } from './data/programSeed';
import {
  createTrainingYear,
  formatProgramPosition,
  getProgramPosition,
  type ProgramPosition,
} from './domain/program/yearEngine';
import {
  isValidNotificationTime,
  planRestTimerNotification,
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
  addSetAfter,
  completeSet,
  completeWorkout,
  createWorkoutDraft,
  removeSet,
  skipSet,
  summarizeWorkoutDraft,
  type WorkoutDraft,
} from './domain/workout/workoutLog';
import {
  createRestTimer,
  getRestTimerState,
  type RestTimer,
} from './domain/workout/restTimer';
import { scheduleLocalNotification } from './notifications/localNotifications';

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
    eyebrow: 'Resolved from the annual program',
    body: 'Today resolves the active program day, workout status, prescribed sets, suggested load, prior records, and the next scheduled workout.',
  },
  {
    key: 'year',
    label: 'Year',
    title: 'Annual Structure',
    eyebrow: '52-week sequence',
    body: 'Year tracks the 52-week structure, completion state, missed sessions, manual rescheduling, deloads, tapers, and testing weeks.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    title: 'Training Evidence',
    eyebrow: 'Derived from logged sets',
    body: 'Analytics derives adherence, volume, strength, frequency, phase comparisons, RPE, and muscle distribution from stored workout data.',
  },
  {
    key: 'history',
    label: 'History',
    title: 'Completed Workouts',
    eyebrow: 'Actual performance stays separate',
    body: 'History preserves completed sessions, duration, total volume, personal records, and planned-versus-actual separation.',
  },
  {
    key: 'library',
    label: 'Library',
    title: 'Exercise and Settings Vault',
    eyebrow: 'Program metadata',
    body: 'Library holds exercises, muscles, faithful alternatives, active substitutions, 1RM records, units, reminders, and data controls.',
  },
];

const muscleNameById: Map<string, string> = new Map(
  programSeed.muscles.map((muscle) => [muscle.id, muscle.name]),
);
const replacementScopes: ExerciseReplacementInput['scope'][] = [
  'today_only',
  'week',
  'future_matching_in_block',
  'block',
  'year',
];
const emptySetEntry = { weight: '', reps: '', rpe: '' };

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [db, setDb] = useState<TrainingDatabase | null>(null);
  const [todayInstance, setTodayInstance] = useState<TodayWorkoutInstance | null>(
    null,
  );
  const [nextWorkoutInstance, setNextWorkoutInstance] =
    useState<TodayWorkoutInstance | null>(null);
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
    setNextWorkoutInstance(await getNextWorkoutInstance(database));
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
                nextWorkoutInstance={nextWorkoutInstance}
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
  nextWorkoutInstance,
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
  nextWorkoutInstance: TodayWorkoutInstance | null;
  todayInstance: TodayWorkoutInstance | null;
}) {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(Date.now());
  const [nextSetEntry, setNextSetEntry] = useState(emptySetEntry);
  const [nextSetNote, setNextSetNote] = useState('');
  const [latestPerformances, setLatestPerformances] = useState<
    LatestExercisePerformance[]
  >([]);
  const [saveStatus, setSaveStatus] = useState('Not saved');

  useEffect(() => {
    setDraft(null);
    setRestTimer(null);
    setNextSetEntry(emptySetEntry);
    setNextSetNote('');
  }, [dueWorkout.status === 'workout_due' ? dueWorkout.workout.id : dueWorkout.status]);

  useEffect(() => {
    if (!db || dueWorkout.status !== 'workout_due') {
      setLatestPerformances([]);
      return;
    }

    const plannedSets = applyExerciseReplacements(
      createPlannedSets(dueWorkout.workout),
      activeReplacements,
    );
    void getLatestExercisePerformances(
      db,
      plannedSets.map((set) => set.exerciseId),
    ).then(setLatestPerformances);
  }, [
    activeReplacements,
    db,
    dueWorkout.status === 'workout_due' ? dueWorkout.workout.id : dueWorkout.status,
  ]);

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
    const summary = draft ? summarizeWorkoutDraft(draft) : null;
    const nextSet = draft?.actualSets.find((set) => !set.completed && !set.skipped);
    const activePlannedSets = draft?.plannedSets ?? plannedSets;
    const previewSets = activePlannedSets.slice(0, 5);
    const latestPerformanceByExercise = new Map(
      latestPerformances.map((performance) => [performance.exerciseId, performance]),
    );
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
                  const plannedSet = activePlannedSets.find(
                    (set) => set.id === nextSet.plannedSetId,
                  );
                  const suggestion = plannedSet
                    ? getSuggestedLoad(
                        plannedSet,
                        oneRmRecords,
                        appSettings.plateIncrement,
                      )
                    : null;
                  const weight =
                    nextSetEntry.weight.trim() === ''
                      ? suggestion?.roundedLow ?? 0
                      : Number(nextSetEntry.weight);
                  const reps =
                    nextSetEntry.reps.trim() === ''
                      ? getDefaultReps(plannedSet?.targetReps ?? null)
                      : Number(nextSetEntry.reps);
                  const rpe =
                    nextSetEntry.rpe.trim() === ''
                      ? plannedSet?.targetRpeHigh ?? null
                      : Number(nextSetEntry.rpe);
                  let nextDraft: WorkoutDraft;

                  try {
                    nextDraft = completeSet(draft, nextSet.plannedSetId, {
                      weight,
                      reps,
                      rpe,
                      notes: nextSetNote.trim() || null,
                    });
                  } catch (error) {
                    setSaveStatus(
                      error instanceof Error ? error.message : 'Invalid set entry',
                    );
                    return;
                  }

                  if (plannedSet) {
                    const nowMs = Date.now();
                    const nextTimer = createRestTimer(plannedSet, nowMs);
                    setRestTimer(nextTimer);
                    setTimerNowMs(Date.now());
                    if (db && todayInstance && nextTimer) {
                      const notification = planRestTimerNotification(
                        new Date(nowMs + nextTimer.durationSeconds * 1000).toISOString(),
                        plannedSet.exerciseName,
                      );
                      void scheduleLocalNotification(notification).then(
                        (externalNotificationId) => {
                          if (!externalNotificationId) return;
                          void savePlannedNotification(
                            db,
                            notification,
                            plannedSet.id,
                            externalNotificationId,
                          );
                        },
                      );
                    }
                  }
                  void saveDraft(nextDraft);
                  setNextSetEntry(emptySetEntry);
                  setNextSetNote('');
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Log Next Set</Text>
              </Pressable>
            ) : null}
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setNextSetEntry(emptySetEntry);
                  setNextSetNote('');
                  void saveDraft(skipSet(draft, nextSet.plannedSetId));
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Skip Next Set</Text>
              </Pressable>
            ) : null}
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveDraft(addSetAfter(draft, nextSet.plannedSetId))}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Add Set</Text>
              </Pressable>
            ) : null}
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  try {
                    void saveDraft(removeSet(draft, nextSet.plannedSetId));
                  } catch (error) {
                    setSaveStatus(
                      error instanceof Error ? error.message : 'Cannot remove set',
                    );
                  }
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Remove Set</Text>
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
                    activePlannedSets.find((set) => set.id === nextSet.plannedSetId)
                      ?.exerciseName ?? 'Set'
                  }`
                : draft.status === 'completed'
                  ? 'Workout completed'
                  : 'All sets logged'}
            </Text>
          ) : null}
          {draft && nextSet ? (
            <>
              <View style={styles.setEntryRow}>
                <TextInput
                  accessibilityLabel="Next set weight"
                  keyboardType="decimal-pad"
                  onChangeText={(weight) =>
                    setNextSetEntry((entry) => ({ ...entry, weight }))
                  }
                  placeholder="Weight"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={nextSetEntry.weight}
                />
                <TextInput
                  accessibilityLabel="Next set reps"
                  keyboardType="number-pad"
                  onChangeText={(reps) =>
                    setNextSetEntry((entry) => ({ ...entry, reps }))
                  }
                  placeholder="Reps"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={nextSetEntry.reps}
                />
                <TextInput
                  accessibilityLabel="Next set RPE"
                  keyboardType="decimal-pad"
                  onChangeText={(rpe) =>
                    setNextSetEntry((entry) => ({ ...entry, rpe }))
                  }
                  placeholder="RPE"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={nextSetEntry.rpe}
                />
              </View>
              <TextInput
                accessibilityLabel="Next set note"
                onChangeText={setNextSetNote}
                placeholder="Set note"
                style={styles.noteInput}
                value={nextSetNote}
              />
            </>
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
              {latestPerformanceByExercise.has(set.exerciseId) ? (
                <Text style={styles.setPrescription}>
                  Previous:{' '}
                  {formatLatestPerformance(
                    latestPerformanceByExercise.get(set.exerciseId),
                    appSettings.preferredUnit,
                  )}
                </Text>
              ) : null}
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
        {nextWorkoutInstance ? (
          <Text style={styles.summaryText}>
            Upcoming: {nextWorkoutInstance.workoutName} -{' '}
            {nextWorkoutInstance.scheduledDate}
          </Text>
        ) : null}
      </View>
    );
  }

  if (dueWorkout.status === 'buffer_week') {
    return (
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryTitle}>Buffer Week</Text>
        <Text style={styles.summaryText}>No training is prescribed for this week.</Text>
        {nextWorkoutInstance ? (
          <Text style={styles.summaryText}>
            Upcoming: {nextWorkoutInstance.workoutName} -{' '}
            {nextWorkoutInstance.scheduledDate}
          </Text>
        ) : null}
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
  const weeklyRpe = getWeeklyAverageRpe(completedSets);
  const blockComparison = compareBlocks(completedSets);
  const phaseComparison = comparePhases(completedSets);
  const consistency = getConsistencyCalendar(calendarWorkouts);
  const trainingFrequency = getTrainingFrequency(calendarWorkouts);
  const muscleExposure = calculateMuscleExposure(completedSets)
    .sort((a, b) => b.volumeLoad - a.volumeLoad)
    .slice(0, 5);
  const muscleHeatmap = calculateMuscleHeatmap(
    calculateMuscleExposure(completedSets),
  )
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 8);
  const maxVolume = Math.max(...weeklyVolume.map((point) => point.totalVolume), 1);
  const maxBlockVolume = Math.max(
    ...blockComparison.map((point) => point.totalVolume),
    1,
  );
  const maxPhaseVolume = Math.max(
    ...phaseComparison.map((point) => point.totalVolume),
    1,
  );
  const maxFrequency = Math.max(
    ...trainingFrequency.map((point) => point.scheduled),
    1,
  );
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
        <Text style={styles.analyticsHeading}>Weekly RPE</Text>
        {weeklyRpe.length === 0 ? (
          <Text style={styles.summaryText}>No rated working sets yet.</Text>
        ) : (
          weeklyRpe.map((point) => (
            <BarRow
              key={point.weekKey}
              label={point.weekKey}
              value={`${Math.round(point.averageRpe * 10) / 10} avg`}
              percent={point.averageRpe * 10}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Block Comparison</Text>
        {blockComparison.length === 0 ? (
          <Text style={styles.summaryText}>No completed block data yet.</Text>
        ) : (
          blockComparison.map((point) => (
            <BarRow
              key={point.blockNumber}
              label={`Block ${point.blockNumber} - ${point.phaseCode}`}
              value={`${point.workingSets} sets`}
              percent={(point.totalVolume / maxBlockVolume) * 100}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Phase Comparison</Text>
        {phaseComparison.length === 0 ? (
          <Text style={styles.summaryText}>No completed phase data yet.</Text>
        ) : (
          phaseComparison.map((point) => (
            <BarRow
              key={point.phaseCode}
              label={point.phaseCode}
              value={`${point.workingSets} sets`}
              percent={(point.totalVolume / maxPhaseVolume) * 100}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Training Frequency</Text>
        {trainingFrequency.length === 0 ? (
          <Text style={styles.summaryText}>No scheduled training frequency yet.</Text>
        ) : (
          trainingFrequency.slice(0, 8).map((point) => (
            <BarRow
              key={point.weekKey}
              label={point.weekKey}
              value={`${point.completed}/${point.scheduled} completed`}
              percent={(point.scheduled / maxFrequency) * 100}
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
        <Text style={styles.analyticsHeading}>Muscle Heatmap</Text>
        {muscleHeatmap.length === 0 ? (
          <Text style={styles.summaryText}>No heatmap data from completed sets yet.</Text>
        ) : (
          <View style={styles.heatmapFigures}>
            <MuscleHeatmapFigure regions={muscleHeatmap} view="front" />
            <MuscleHeatmapFigure regions={muscleHeatmap} view="back" />
          </View>
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
                {item.durationSeconds !== null
                  ? ` - ${formatDuration(item.durationSeconds)}`
                  : ''}
              </Text>
              {item.lastSetNote ? (
                <Text style={styles.setPrescription}>Note: {item.lastSetNote}</Text>
              ) : null}
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
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
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
    action: 'skip' | 'do_today_and_shift' | 'move_to_date',
  ) => {
    if (!db) return;

    const moveDate = moveDates[workout.instanceId];
    if (action === 'move_to_date' && !/^\d{4}-\d{2}-\d{2}$/.test(moveDate ?? '')) {
      setStatus('Enter move date as YYYY-MM-DD');
      return;
    }

    await resolveMissedWorkoutInstance(
      db,
      workout.instanceId,
      action === 'skip'
        ? { action, reason: 'Skipped from Year view' }
        : action === 'move_to_date'
          ? {
              action,
              date: moveDate,
              reason: 'Manual move from Year view',
            }
          : { action, today: new Date().toISOString().slice(0, 10) },
    );
    await onSaved(db);
    setStatus(
      action === 'skip'
        ? 'Workout skipped'
        : action === 'move_to_date'
          ? 'Workout moved manually'
          : 'Workout moved to today',
    );
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
              <TextInput
                accessibilityLabel={`Move date for ${workout.workoutName}`}
                onChangeText={(value) =>
                  setMoveDates((current) => ({
                    ...current,
                    [workout.instanceId]: value,
                  }))
                }
                placeholder="YYYY-MM-DD"
                style={styles.baselineInput}
                value={moveDates[workout.instanceId] ?? ''}
              />
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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void resolve(workout, 'move_to_date')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Move</Text>
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
  const [draftWorkoutReminderTime, setDraftWorkoutReminderTime] = useState('');
  const [draftMissedReminderTime, setDraftMissedReminderTime] = useState('');
  const [saveStatus, setSaveStatus] = useState('Baselines not changed');
  const [replacementScope, setReplacementScope] =
    useState<ExerciseReplacementInput['scope']>('today_only');
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
      scope: replacementScope,
    });
    await onSaved(db);
    setSaveStatus(`Substitution saved: ${formatReplacementScope(replacementScope)}`);
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
  const toggleNotificationSetting = async (
    key:
      | 'missedWorkoutEnabled'
      | 'deloadRemindersEnabled'
      | 'testWeekRemindersEnabled',
  ) => {
    if (!db) return;

    await saveNotificationSettings(db, {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    });
    await onSaved(db);
    setSaveStatus('Notification settings saved');
  };
  const saveReminderTimes = async () => {
    if (!db) return;

    const workoutTime =
      draftWorkoutReminderTime || notificationSettings.workoutReminderTime || '';
    const missedTime =
      draftMissedReminderTime || notificationSettings.missedWorkoutTime || '';
    if (!isValidNotificationTime(workoutTime) || !isValidNotificationTime(missedTime)) {
      setSaveStatus('Use reminder time format HH:MM');
      return;
    }

    await saveNotificationSettings(db, {
      ...notificationSettings,
      workoutReminderTime: workoutTime,
      missedWorkoutTime: missedTime,
    });
    await onSaved(db);
    setDraftWorkoutReminderTime('');
    setDraftMissedReminderTime('');
    setSaveStatus('Reminder times saved');
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

    const externalNotificationId = await scheduleLocalNotification(notification);
    if (!externalNotificationId) {
      setSaveStatus('Notification permission denied or time has passed');
      return;
    }

    await savePlannedNotification(db, notification, null, externalNotificationId);
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
        <Text style={styles.summaryText}>
          Missed workout reminder: {notificationSettings.missedWorkoutTime ?? 'unset'}
        </Text>
        <Text style={styles.summaryText}>
          Missed: {notificationSettings.missedWorkoutEnabled ? 'on' : 'off'} - Deload/taper:{' '}
          {notificationSettings.deloadRemindersEnabled ? 'on' : 'off'} - Test week:{' '}
          {notificationSettings.testWeekRemindersEnabled ? 'on' : 'off'}
        </Text>
        <View style={styles.actionRow}>
          <TextInput
            accessibilityLabel="Workout reminder time"
            inputMode="numeric"
            onChangeText={setDraftWorkoutReminderTime}
            placeholder={notificationSettings.workoutReminderTime ?? 'HH:MM'}
            style={styles.baselineInput}
            value={draftWorkoutReminderTime}
          />
          <TextInput
            accessibilityLabel="Missed workout reminder time"
            inputMode="numeric"
            onChangeText={setDraftMissedReminderTime}
            placeholder={notificationSettings.missedWorkoutTime ?? 'HH:MM'}
            style={styles.baselineInput}
            value={draftMissedReminderTime}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleWorkoutReminder()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Reminders</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleNotificationSetting('missedWorkoutEnabled')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Missed</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleNotificationSetting('deloadRemindersEnabled')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Deload</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void toggleNotificationSetting('testWeekRemindersEnabled')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Test</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveReminderTimes()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Save Times</Text>
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
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Substitution Scope</Text>
        <Text style={styles.summaryText}>
          New substitutions apply to {formatReplacementScope(replacementScope)}.
        </Text>
        <View style={styles.actionRow}>
          {replacementScopes.map((scope) => (
            <Pressable
              accessibilityRole="button"
              key={scope}
              onPress={() => setReplacementScope(scope)}
              style={[
                styles.secondaryButton,
                replacementScope === scope ? styles.selectedButton : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {formatReplacementScope(scope)}
              </Text>
            </Pressable>
          ))}
        </View>
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

function MuscleHeatmapFigure({
  regions,
  view,
}: {
  regions: MuscleHeatmapRegion[];
  view: MuscleHeatmapRegion['view'];
}) {
  const visibleRegions = regions
    .filter((region) => region.view === view)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);

  return (
    <View
      accessibilityLabel={`${view} muscle heatmap`}
      style={styles.heatmapFigure}
    >
      <Text style={styles.heatmapTitle}>{view === 'front' ? 'Front' : 'Back'}</Text>
      <View style={styles.bodyMap}>
        {visibleRegions.length === 0 ? (
          <Text style={styles.heatmapEmpty}>No exposure</Text>
        ) : (
          visibleRegions.map((region) => (
            <View
              key={`${view}_${region.muscleId}`}
              style={[
                styles.bodyRegion,
                {
                  backgroundColor: `rgba(30, 58, 95, ${Math.min(
                    0.9,
                    0.18 + region.intensity * 0.72,
                  )})`,
                },
              ]}
            >
              <Text style={styles.bodyRegionText}>{region.name}</Text>
              <Text style={styles.bodyRegionMeta}>
                {region.hardSets.toFixed(1)} sets
              </Text>
            </View>
          ))
        )}
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

function formatLatestPerformance(
  performance: LatestExercisePerformance | undefined,
  unit: AppSettings['preferredUnit'],
) {
  if (!performance) return 'none';
  const rpe = performance.rpe === null ? '' : `, RPE ${performance.rpe}`;
  return `${performance.weight} ${unit} x ${performance.reps}${rpe}`;
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

function formatReplacementScope(scope: ExerciseReplacementInput['scope']) {
  if (scope === 'today_only') return 'Today';
  if (scope === 'week') return 'Week';
  if (scope === 'future_matching_in_block') return 'Future Block Matches';
  if (scope === 'block') return 'Block';
  return 'Year';
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
  noteInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  setEntryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  setEntryInput: {
    flex: 1,
    minWidth: 0,
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
  selectedButton: {
    backgroundColor: '#DBEAFE',
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
  heatmapFigures: {
    flexDirection: 'row',
    gap: 10,
  },
  heatmapFigure: {
    flex: 1,
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  heatmapTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  bodyMap: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  bodyRegion: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  bodyRegionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  bodyRegionMeta: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  heatmapEmpty: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  analyticsFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
