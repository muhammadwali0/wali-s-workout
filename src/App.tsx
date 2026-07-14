import { StatusBar } from 'expo-status-bar';
import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
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
import type { LayoutChangeEvent } from 'react-native';

import {
  getCalendarWorkouts,
  getCompletedAnalyticsSets,
  getEstimatedOneRmTrend,
  getPlannedAnalyticsSets,
  getPlannedVsActualWorkouts,
  getSessionDurationPoints,
  type AnalyticsSet,
  type PlannedAnalyticsSet,
  type PlannedVsActualWorkout,
  type SessionDurationPoint,
  type StrengthTrendPoint,
} from './db/analyticsQueries';
import {
  getExerciseAlternatives,
  type ExerciseAlternativeItem,
} from './db/alternativeQueries';
import { openTrainingDatabase, type TrainingDatabase } from './db/database';
import {
  getLastCompletedWorkout,
  getLatestExercisePerformances,
  getNextWorkoutInstance,
  getTodayWorkoutInstance,
  skipTodayWorkoutInstance,
  type LastCompletedWorkout,
  type LatestExercisePerformance,
  type TodayWorkoutInstance,
} from './db/todayWorkoutQuery';
import {
  getWorkoutHistorySets,
  getRecentWorkoutHistory,
  updateWorkoutHistorySet,
  type WorkoutHistorySet,
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
  saveCustomAlternative,
  saveExerciseReplacement,
  type ActiveExerciseReplacement,
  type ExerciseReplacementInput,
} from './db/modificationQueries';
import { getActiveProgramYearStart } from './db/programSeedRows';
import { getAppSettings, saveAppSettings } from './db/settingsQueries';
import {
  buildExportFiles,
  getTrainingDataExport,
  previewTrainingDataExport,
  resetNotificationData,
  resetUserTrainingData,
  restoreTrainingDataExport,
  type TrainingDataExportPreview,
} from './db/exportQueries';
import { saveWorkoutDraft } from './db/workoutLogPersistence';
import { getSavedWorkoutDraft } from './db/workoutDraftQuery';
import {
  formatCalendarDayLabel,
  getConsistencyCalendar,
  type CalendarDay,
  type CalendarWorkout,
} from './domain/analytics/consistencyCalendar';
import { compareBlocks, comparePhases } from './domain/analytics/blockComparison';
import { calculateMuscleExposure } from './domain/analytics/muscleExposure';
import {
  calculateMuscleHeatmap,
  type MuscleHeatmapRegion,
} from './domain/analytics/muscleHeatmap';
import { getTrainingFrequency } from './domain/analytics/trainingFrequency';
import { calculateFatigueSignals } from './domain/analytics/fatigueSignals';
import { getLineChartPlot } from './domain/analytics/lineChart';
import { getWeeklyAverageRpe } from './domain/analytics/weeklyRpe';
import { getWeeklyVolume } from './domain/analytics/weeklyVolume';
import {
  comparePlannedActualMuscleExposure,
  getBlockReport,
  getFatigueReasons,
} from './domain/analytics/v2Reports';
import {
  filterAnalyticsSets,
  type AnalyticsSetFilter,
} from './domain/analytics/setFilters';
import { programSeed } from './data/programSeed';
import {
  createTrainingYear,
  formatProgramPosition,
  getProgramWeekStart,
  getProgramPosition,
  type ProgramPosition,
} from './domain/program/yearEngine';
import { getPhaseTransitionSummary } from './domain/program/phaseTransition';
import { getTestWeekAssistant } from './domain/program/testWeekAssistant';
import {
  isValidNotificationTime,
  planNextMissedWorkoutNotification,
  planNextWeekStatusNotification,
  planRestTimerNotification,
  planUnfinishedSessionNotification,
  planWorkoutDueNotification,
  type NotificationSettings,
} from './domain/notifications/notificationPlanner';
import { defaultSettings, type AppSettings } from './domain/settings/appSettings';
import {
  getBackupSyncStatus,
  type BackupSyncStatus,
} from './domain/settings/backupSyncStatus';
import { getSuggestedLoad, needsOneRmRecord } from './domain/load/suggestedLoad';
import { transferPhaseEndToBlockBaseline } from './domain/load/oneRmVault';
import { estimateOneRepMax } from './domain/load/loadCalculator';
import { getDueWorkout } from './domain/program/seedResolver';
import {
  applyExerciseReplacements,
  createPlannedSets,
  type PlannedSet,
} from './domain/workout/sessionPlanner';
import {
  addExercise,
  addSetAfter,
  completeSet,
  completeWorkout,
  createWorkoutDraft,
  discardWorkout,
  removeExercise,
  removeSet,
  skipSet,
  summarizeWorkoutDraft,
  updatePlannedSet,
  type WorkoutDraft,
} from './domain/workout/workoutLog';
import {
  addRestTime,
  createRestTimer,
  getRestTimerState,
  pauseRestTimer,
  resumeRestTimer,
  type RestTimer,
} from './domain/workout/restTimer';
import { scheduleLocalNotification } from './notifications/localNotifications';

type TabKey = 'today' | 'year' | 'analytics' | 'history' | 'library';
type HeatmapRange = 'year' | 'week' | 'block' | 'phase' | 'custom';

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
const emptySetEntry = { weight: '', reps: '', rpe: '', rir: '' };
const emptyPrescriptionEntry = { reps: '', percent: '', rpe: '', rest: '' };
const compositionColors = ['#1E3A5F', '#2563EB', '#0F766E', '#7C2D12', '#6D28D9'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [db, setDb] = useState<TrainingDatabase | null>(null);
  const [todayInstance, setTodayInstance] = useState<TodayWorkoutInstance | null>(
    null,
  );
  const [nextWorkoutInstance, setNextWorkoutInstance] =
    useState<TodayWorkoutInstance | null>(null);
  const [lastCompletedWorkout, setLastCompletedWorkout] =
    useState<LastCompletedWorkout | null>(null);
  const [analyticsSets, setAnalyticsSets] = useState<AnalyticsSet[]>([]);
  const [plannedAnalyticsSets, setPlannedAnalyticsSets] = useState<
    PlannedAnalyticsSet[]
  >([]);
  const [plannedVsActual, setPlannedVsActual] = useState<PlannedVsActualWorkout[]>(
    [],
  );
  const [strengthTrend, setStrengthTrend] = useState<StrengthTrendPoint[]>([]);
  const [sessionDurations, setSessionDurations] = useState<SessionDurationPoint[]>(
    [],
  );
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
  const [programStartDate, setProgramStartDate] = useState(() =>
    getProgramWeekStart(new Date()),
  );
  const [dbStatus, setDbStatus] = useState('Opening local database');
  const [setupRestoreJson, setSetupRestoreJson] = useState('');
  const [setupStatus, setSetupStatus] = useState('Program setup not completed');
  const trainingYear = useMemo(() => {
    return createTrainingYear(programStartDate);
  }, [programStartDate]);
  styles = getStyles(appSettings.theme);
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
    setProgramStartDate(await getActiveProgramYearStart(database));
    setTodayInstance(await getTodayWorkoutInstance(database));
    setNextWorkoutInstance(await getNextWorkoutInstance(database));
    setLastCompletedWorkout(await getLastCompletedWorkout(database));
    setAnalyticsSets(await getCompletedAnalyticsSets(database));
    setPlannedAnalyticsSets(await getPlannedAnalyticsSets(database));
    setPlannedVsActual(await getPlannedVsActualWorkouts(database));
    setStrengthTrend(await getEstimatedOneRmTrend(database));
    setSessionDurations(await getSessionDurationPoints(database));
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

  const completeInitialSetup = async () => {
    if (!db) return;

    await saveAppSettings(db, { ...appSettings, setupCompleted: true });
    await refreshLocalData(db);
    setSetupStatus('Setup completed');
  };
  const restoreInitialBackup = async () => {
    if (!db) return;

    try {
      await restoreTrainingDataExport(db, setupRestoreJson);
      await saveAppSettings(db, { ...(await getAppSettings(db)), setupCompleted: true });
      setSetupRestoreJson('');
      await refreshLocalData(db);
      setSetupStatus('Backup restored');
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : 'Restore failed');
    }
  };

  if (!appSettings.setupCompleted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={appSettings.theme === 'scholar_dark' ? 'light' : 'dark'} />
        <View style={styles.shell}>
          <View style={styles.header}>
            <Text style={styles.appName}>Wali's Workout</Text>
            <Text style={styles.dateText}>Structured Training Logbook</Text>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.positionCard}>
              <Text style={styles.meta}>First Launch</Text>
              <Text style={styles.positionTitle}>Program Setup</Text>
              <Text style={styles.eyebrow}>{dbStatus}</Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Begin Setup</Text>
              <Text style={styles.body}>
                Confirm local program data, units, plate increments, reminder defaults, and
                baseline entry before opening the training workspace.
              </Text>
              <Text style={styles.summaryText}>{setupStatus}</Text>
              <View style={styles.baselinePanel}>
                <Text style={styles.sessionTitle}>Setup Summary</Text>
                <Text style={styles.setPrescription}>
                  Program calendar: {libraryExercises.length > 0 ? 'Loaded' : 'Loading'}
                </Text>
                <Text style={styles.setPrescription}>
                  Units: {appSettings.preferredUnit} - barbell {appSettings.barbellWeight} -
                  plate increment {appSettings.plateIncrement}
                </Text>
                <Text style={styles.setPrescription}>
                  Reminders: {notificationSettings.workoutRemindersEnabled ? 'Enabled' : 'Disabled'} -{' '}
                  {notificationSettings.workoutReminderTime ?? 'unset'}
                </Text>
              </View>
              <TextInput
                accessibilityLabel="Restore backup JSON during setup"
                multiline
                onChangeText={setSetupRestoreJson}
                placeholder="Paste exported JSON backup to restore instead"
                style={styles.noteInput}
                value={setupRestoreJson}
              />
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !db }}
                  disabled={!db}
                  onPress={() => void completeInitialSetup()}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Begin Setup</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !db || setupRestoreJson.trim() === '' }}
                  disabled={!db || setupRestoreJson.trim() === ''}
                  onPress={() => void restoreInitialBackup()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Restore Backup</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={appSettings.theme === 'scholar_dark' ? 'light' : 'dark'} />
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
              {activeTab === 'today'
                ? `Week type: ${formatCleanLabel(weekType)}`
                : active.eyebrow}
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
                lastCompletedWorkout={lastCompletedWorkout}
                libraryExercises={libraryExercises}
                notificationSettings={notificationSettings}
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
                plannedVsActual={plannedVsActual}
                plannedSets={plannedAnalyticsSets}
                position={position}
                sessionDurations={sessionDurations}
                strengthTrend={strengthTrend}
              />
            ) : null}
            {activeTab === 'history' ? (
              <HistorySummary
                db={db}
                dbStatus={dbStatus}
                historyItems={historyItems}
                onSaved={refreshLocalData}
                personalRecords={personalRecords}
              />
            ) : null}
            {activeTab === 'year' ? (
              <YearSummary
                calendarWorkouts={calendarWorkouts}
                db={db}
                dbStatus={dbStatus}
                missedWorkouts={missedWorkouts}
                notificationSettings={notificationSettings}
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
  lastCompletedWorkout,
  libraryExercises,
  notificationSettings,
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
  lastCompletedWorkout: LastCompletedWorkout | null;
  libraryExercises: ExerciseLibraryItem[];
  notificationSettings: NotificationSettings;
  onSaved: (database: TrainingDatabase) => Promise<void>;
  oneRmRecords: CurrentOneRmRecord[];
  nextWorkoutInstance: TodayWorkoutInstance | null;
  todayInstance: TodayWorkoutInstance | null;
}) {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(Date.now());
  const [nextSetEntry, setNextSetEntry] = useState(emptySetEntry);
  const [prescriptionEntry, setPrescriptionEntry] = useState(emptyPrescriptionEntry);
  const [nextSetNote, setNextSetNote] = useState('');
  const [latestPerformances, setLatestPerformances] = useState<
    LatestExercisePerformance[]
  >([]);
  const [saveStatus, setSaveStatus] = useState('Not saved');

  useEffect(() => {
    setDraft(null);
    setRestTimer(null);
    setNextSetEntry(emptySetEntry);
    setPrescriptionEntry(emptyPrescriptionEntry);
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
    const testWeekAssistant = getTestWeekAssistant(
      dueWorkout.workout.workoutType,
      plannedSets,
      oneRmRecords,
    );
    const summary = draft ? summarizeWorkoutDraft(draft) : null;
    const nextSet = draft?.actualSets.find((set) => !set.completed && !set.skipped);
    const activePlannedSets = draft?.plannedSets ?? plannedSets;
    const previewSets = activePlannedSets.slice(0, 5);
    const todayMuscleExposure = calculateMuscleExposure(
      activePlannedSets.map((set) => ({
        exerciseId: set.exerciseId,
        setType: set.setType,
        completed: true,
        weight: null,
        reps: null,
      })),
    )
      .sort((a, b) => b.hardSets - a.hardSets)
      .slice(0, 4);
    const maxTodayHardSets = Math.max(
      ...todayMuscleExposure.map((exposure) => exposure.hardSets),
      1,
    );
    const todayMuscleHeatmap = calculateMuscleHeatmap(todayMuscleExposure)
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 8);
    const latestPerformanceByExercise = new Map(
      latestPerformances.map((performance) => [performance.exerciseId, performance]),
    );
    const activeExerciseIds = new Set(
      activePlannedSets.map((set) => set.exerciseId),
    );
    const libraryByExercise = new Map(
      libraryExercises.map((exercise) => [exercise.exerciseId, exercise]),
    );
    const exerciseDetailGroups = Array.from(
      activePlannedSets
        .reduce((groups, set) => {
          const group = groups.get(set.exerciseOrder) ?? [];
          group.push(set);
          groups.set(set.exerciseOrder, group);
          return groups;
        }, new Map<number, PlannedSet[]>())
        .values(),
    );
    const addableExercises = libraryExercises
      .filter((exercise) => !activeExerciseIds.has(exercise.exerciseId))
      .slice(0, 6);
    const timerState = restTimer
      ? getRestTimerState(restTimer, timerNowMs)
      : null;
    const saveDraft = async (nextDraft: WorkoutDraft) => {
      const nextSummary = summarizeWorkoutDraft(nextDraft);
      const currentCompletedSets = draft ? summarizeWorkoutDraft(draft).completedSets : 0;
      setDraft(nextDraft.status === 'discarded' ? null : nextDraft);
      if (!db || !todayInstance) return;

      await saveWorkoutDraft(db, nextDraft, {
        workoutLogId: `${todayInstance.instanceId}_log`,
        workoutInstanceId: todayInstance.instanceId,
        recordedAt: new Date().toISOString(),
        unit: appSettings.preferredUnit,
      });
      if (
        nextDraft.status === 'draft' &&
        currentCompletedSets === 0 &&
        nextSummary.completedSets > 0
      ) {
        const notification = planUnfinishedSessionNotification(
          new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          dueWorkout.workout.name,
          notificationSettings,
        );
        if (notification) {
          const externalNotificationId = await scheduleLocalNotification(notification);
          if (externalNotificationId) {
            await savePlannedNotification(
              db,
              notification,
              todayInstance.instanceId,
              externalNotificationId,
            );
          }
        }
      }
      await onSaved(db);
      setSaveStatus('Saved locally');
    };
    const logNextSet = async (failed = false) => {
      if (!draft || !nextSet) return;

      const plannedSet = activePlannedSets.find(
        (set) => set.id === nextSet.plannedSetId,
      );
      const suggestion = plannedSet
        ? getSuggestedLoad(plannedSet, oneRmRecords, appSettings.plateIncrement)
        : null;
      if (
        plannedSet &&
        needsOneRmRecord(plannedSet) &&
        !suggestion &&
        nextSetEntry.weight.trim() === ''
      ) {
        const latest = latestPerformanceByExercise.get(plannedSet.exerciseId);
        if (latest && db) {
          await saveOneRmRecord(db, {
            exerciseId: plannedSet.exerciseId,
            value: estimateOneRepMax(latest.weight, latest.reps),
            unit: appSettings.preferredUnit,
            recordType: 'estimated',
            programBlockId: null,
          });
          await onSaved(db);
          setSaveStatus(
            `Estimated 1RM saved for ${plannedSet.exerciseName}; log the set again`,
          );
          return;
        }
        setSaveStatus(`Missing 1RM for ${plannedSet.exerciseName}; enter weight manually`);
        return;
      }
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
      const rir = nextSetEntry.rir.trim() === '' ? null : Number(nextSetEntry.rir);
      let nextDraft: WorkoutDraft;

      try {
        nextDraft = completeSet(draft, nextSet.plannedSetId, {
          weight,
          reps,
          rpe,
          rir,
          failed,
          notes: nextSetNote.trim() || null,
        });
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : 'Invalid set entry');
        return;
      }

      if (plannedSet) {
        const nowMs = Date.now();
        const nextTimer = createRestTimer(plannedSet, nowMs);
        setRestTimer(nextTimer);
        setTimerNowMs(Date.now());
        if (
          db &&
          todayInstance &&
          nextTimer &&
          (appSettings.restAlertSound || appSettings.restAlertVibration)
        ) {
          const notification = planRestTimerNotification(
            new Date(nowMs + nextTimer.durationSeconds * 1000).toISOString(),
            plannedSet.exerciseName,
          );
          void scheduleLocalNotification(notification).then((externalNotificationId) => {
            if (!externalNotificationId) return;
            void savePlannedNotification(
              db,
              notification,
              plannedSet.id,
              externalNotificationId,
            );
          });
        }
      }
      void saveDraft(nextDraft);
      setNextSetEntry(emptySetEntry);
      setPrescriptionEntry(emptyPrescriptionEntry);
      setNextSetNote('');
    };
    const updateNextSetPrescription = () => {
      if (!draft || !nextSet) return;

      const changes: {
        targetReps?: string | null;
        percent1Rm?: number | null;
        targetRpe?: number | null;
        restSeconds?: number | null;
      } = {};
      if (prescriptionEntry.reps.trim() !== '') {
        changes.targetReps = prescriptionEntry.reps.trim();
      }
      if (prescriptionEntry.percent.trim() !== '') {
        changes.percent1Rm = Number(prescriptionEntry.percent);
      }
      if (prescriptionEntry.rpe.trim() !== '') {
        changes.targetRpe = Number(prescriptionEntry.rpe);
      }
      if (prescriptionEntry.rest.trim() !== '') {
        changes.restSeconds = Number(prescriptionEntry.rest);
      }
      if (Object.keys(changes).length === 0) {
        setSaveStatus('Enter at least one target change');
        return;
      }

      try {
        void saveDraft(updatePlannedSet(draft, nextSet.plannedSetId, changes));
        setPrescriptionEntry(emptyPrescriptionEntry);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : 'Invalid target');
      }
    };
    const skipWorkout = async () => {
      if (!db || !todayInstance) return;

      await skipTodayWorkoutInstance(db, todayInstance.instanceId);
      setDraft(null);
      setRestTimer(null);
      setNextSetEntry(emptySetEntry);
      setPrescriptionEntry(emptyPrescriptionEntry);
      setNextSetNote('');
      await onSaved(db);
      setSaveStatus('Workout skipped');
    };

    return (
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryTitle}>{dueWorkout.workout.name}</Text>
        <Text style={styles.summaryText}>
          {dbStatus}
          {todayInstance
            ? ` - ${formatCleanLabel(todayInstance.status)} - ${todayInstance.instanceId}`
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
        {testWeekAssistant.isTestWorkout ? (
          <View style={styles.sessionPanel}>
            <Text style={styles.sessionTitle}>Test Week Assistant</Text>
            <Text style={styles.summaryText}>
              Primary tests: {testWeekAssistant.primaryExercises.join(', ') || 'none'}.
            </Text>
            <Text style={styles.setPrescription}>
              Tested records saved: {testWeekAssistant.testedRecords}. Missing
              baselines:{' '}
              {testWeekAssistant.missingBaselineExercises.length === 0
                ? 'none'
                : testWeekAssistant.missingBaselineExercises.join(', ')}
              .
            </Text>
            <Text style={styles.setPrescription}>
              Use the Library 1RM vault to save tested values, then confirm phase
              baselines during the transition buffer.
            </Text>
          </View>
        ) : null}
        {todayMuscleExposure.length > 0 ? (
          <View style={styles.sessionPanel}>
            <Text style={styles.sessionTitle}>Current Workout Muscle Exposure</Text>
            <View style={styles.heatmapFigures}>
              <MuscleHeatmapFigure regions={todayMuscleHeatmap} view="front" />
              <MuscleHeatmapFigure regions={todayMuscleHeatmap} view="back" />
            </View>
            {todayMuscleExposure.map((exposure) => (
              <BarRow
                key={exposure.muscleId}
                label={muscleNameById.get(exposure.muscleId) ?? exposure.muscleId}
                value={`${exposure.hardSets.toFixed(1)} planned hard sets`}
                percent={(exposure.hardSets / maxTodayHardSets) * 100}
              />
            ))}
          </View>
        ) : null}
        {lastCompletedWorkout ? (
          <Text style={styles.summaryText}>
            Last completed: {lastCompletedWorkout.workoutName} -{' '}
            {lastCompletedWorkout.totalWorkingSets ?? 0} working sets -{' '}
            {lastCompletedWorkout.totalVolume ?? 0} kg reps
          </Text>
        ) : null}
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
              onPress={() => {
                if (draft) {
                  setSaveStatus('Active workout already in progress');
                  return;
                }
                void saveDraft(createWorkoutDraft(dueWorkout.workout.id, plannedSets));
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {draft ? 'Resume Active' : 'Start'}
              </Text>
            </Pressable>
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void logNextSet()}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Log Next Set</Text>
              </Pressable>
            ) : null}
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void logNextSet(true)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Fail Next Set</Text>
              </Pressable>
            ) : null}
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setNextSetEntry(emptySetEntry);
                  setPrescriptionEntry(emptyPrescriptionEntry);
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
            {draft && nextSet ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  try {
                    void saveDraft(removeExercise(draft, nextSet.plannedSetId));
                  } catch (error) {
                    setSaveStatus(
                      error instanceof Error
                        ? error.message
                        : 'Cannot remove exercise',
                    );
                  }
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Remove Exercise</Text>
              </Pressable>
            ) : null}
            {draft && addableExercises.map((exercise) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${exercise.name}`}
                key={exercise.exerciseId}
                onPress={() => void saveDraft(addExercise(draft, exercise))}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Add {exercise.name}</Text>
              </Pressable>
            ))}
            {draft ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveDraft(discardWorkout(draft))}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Discard</Text>
              </Pressable>
            ) : null}
            {!draft &&
            todayInstance &&
            ['scheduled', 'rescheduled'].includes(todayInstance.status) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void skipWorkout()}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Skip Workout</Text>
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
                <TextInput
                  accessibilityLabel="Next set RIR"
                  keyboardType="decimal-pad"
                  onChangeText={(rir) =>
                    setNextSetEntry((entry) => ({ ...entry, rir }))
                  }
                  placeholder="RIR"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={nextSetEntry.rir}
                />
              </View>
              <TextInput
                accessibilityLabel="Next set note"
                onChangeText={setNextSetNote}
                placeholder="Set note"
                style={styles.noteInput}
                value={nextSetNote}
              />
              <View style={styles.setEntryRow}>
                <TextInput
                  accessibilityLabel="Personalized target reps"
                  keyboardType="number-pad"
                  onChangeText={(reps) =>
                    setPrescriptionEntry((entry) => ({ ...entry, reps }))
                  }
                  placeholder="Target reps"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={prescriptionEntry.reps}
                />
                <TextInput
                  accessibilityLabel="Personalized target percent 1RM"
                  keyboardType="decimal-pad"
                  onChangeText={(percent) =>
                    setPrescriptionEntry((entry) => ({ ...entry, percent }))
                  }
                  placeholder="%1RM"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={prescriptionEntry.percent}
                />
                <TextInput
                  accessibilityLabel="Personalized target RPE"
                  keyboardType="decimal-pad"
                  onChangeText={(rpe) =>
                    setPrescriptionEntry((entry) => ({ ...entry, rpe }))
                  }
                  placeholder="Target RPE"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={prescriptionEntry.rpe}
                />
                <TextInput
                  accessibilityLabel="Personalized rest seconds"
                  keyboardType="number-pad"
                  onChangeText={(rest) =>
                    setPrescriptionEntry((entry) => ({ ...entry, rest }))
                  }
                  placeholder="Rest sec"
                  style={[styles.noteInput, styles.setEntryInput]}
                  value={prescriptionEntry.rest}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={updateNextSetPrescription}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Update Target</Text>
              </Pressable>
            </>
          ) : null}
          {timerState && restTimer ? (
            <>
              <Text style={styles.currentSetText}>
                Rest: {formatDuration(timerState.remainingSeconds)}
                {timerState.isComplete ? ' complete' : timerState.isPaused ? ' paused' : ''}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRestTimer(addRestTime(restTimer, 30))}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Add 30s</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const nowMs = Date.now();
                    setTimerNowMs(nowMs);
                    setRestTimer(
                      restTimer.pausedAtMs === null
                        ? pauseRestTimer(restTimer, nowMs)
                        : resumeRestTimer(restTimer, nowMs),
                    );
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    {restTimer.pausedAtMs === null ? 'Pause' : 'Resume'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRestTimer(null)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Skip Timer</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
        <View style={styles.sessionPanel}>
          <Text style={styles.sessionTitle}>Exercise Detail</Text>
          {exerciseDetailGroups.map((sets) => {
            const firstSet = sets[0];
            const exercise = libraryByExercise.get(firstSet.exerciseId);
            const hasMissingOneRm = sets.some(
              (set) =>
                needsOneRmRecord(set) &&
                !oneRmRecords.some((record) => record.exerciseId === set.exerciseId),
            );

            return (
              <View key={`${firstSet.exerciseOrder}-${firstSet.exerciseId}`} style={styles.setRow}>
                <Text style={styles.setExercise}>{firstSet.exerciseName}</Text>
                <Text style={styles.setPrescription}>
                  {formatPlannedExerciseSummary(
                    sets,
                    oneRmRecords,
                    appSettings.plateIncrement,
                    appSettings.preferredUnit,
                  )}
                </Text>
                <Text style={styles.setPrescription}>
                  Role: {formatCleanLabel(firstSet.exerciseRole)}
                  {firstSet.supersetGroup ? ` - Superset ${firstSet.supersetGroup}` : ''}
                  {exercise?.movementPattern ? ` - ${formatCleanLabel(exercise.movementPattern)}` : ''}
                </Text>
                {exercise?.primaryMuscles ? (
                  <Text style={styles.setPrescription}>
                    Primary muscles: {exercise.primaryMuscles}
                  </Text>
                ) : null}
                {firstSet.substitutionScope ? (
                  <Text style={styles.setPrescription}>
                    Substitute for {firstSet.originalExerciseName} -{' '}
                    {formatReplacementScope(firstSet.substitutionScope)}
                  </Text>
                ) : null}
                {latestPerformanceByExercise.has(firstSet.exerciseId) ? (
                  <Text style={styles.setPrescription}>
                    Previous:{' '}
                    {formatLatestPerformance(
                      latestPerformanceByExercise.get(firstSet.exerciseId),
                      appSettings.preferredUnit,
                    )}
                  </Text>
                ) : null}
                {hasMissingOneRm ? (
                  <Text style={styles.warningText}>
                    Missing 1RM for percentage load calculation
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.setPreview}>
          {previewSets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setExercise}>{set.exerciseName}</Text>
              <Text style={styles.setPrescription}>
                Role: {formatCleanLabel(set.exerciseRole)}
                {set.supersetGroup ? ` - Superset ${set.supersetGroup}` : ''}
              </Text>
              {set.substitutionScope ? (
                <Text style={styles.setPrescription}>
                  Original: {set.originalExerciseName} - {formatReplacementScope(set.substitutionScope)}
                </Text>
              ) : null}
              <Text style={styles.setPrescription}>
                Set {set.setNumber} - {formatCleanLabel(set.setType)}
                {set.targetReps ? ` - ${set.targetReps} reps` : ''}
                {formatPercentRange(set.percent1RmLow, set.percent1RmHigh)}
                {formatSuggestedLoad(
                  getSuggestedLoad(set, oneRmRecords, appSettings.plateIncrement),
                  appSettings.preferredUnit,
                )}
                {formatRpeRange(set.targetRpeLow, set.targetRpeHigh)}
                {formatRestRange(set.restSecondsMin, set.restSecondsMax)}
                {set.tempo ? ` - Tempo ${set.tempo}` : ''}
              </Text>
              {set.notes ? (
                <Text style={styles.setPrescription}>Note: {set.notes}</Text>
              ) : null}
              {needsOneRmRecord(set) &&
              !oneRmRecords.some((record) => record.exerciseId === set.exerciseId) ? (
                <Text style={styles.warningText}>
                  Missing 1RM for {set.exerciseName}
                </Text>
              ) : null}
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
  plannedVsActual,
  plannedSets,
  position,
  sessionDurations,
  strengthTrend,
}: {
  calendarWorkouts: CalendarWorkout[];
  completedSets: AnalyticsSet[];
  dbStatus: string;
  plannedVsActual: PlannedVsActualWorkout[];
  plannedSets: PlannedAnalyticsSet[];
  position: ProgramPosition;
  sessionDurations: SessionDurationPoint[];
  strengthTrend: StrengthTrendPoint[];
}) {
  const [heatmapRange, setHeatmapRange] = useState<HeatmapRange>('year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedInsight, setSelectedInsight] = useState(
    'Select a chart row or heatmap region for exact values.',
  );
  const heatmapFilter = getHeatmapFilter(
    heatmapRange,
    position,
    customStartDate,
    customEndDate,
  );
  const filteredCompletedSets = filterAnalyticsSets(completedSets, heatmapFilter);
  const filteredPlannedSets = filterAnalyticsSets(plannedSets, heatmapFilter);
  const weeklyVolume = getWeeklyVolume(filteredCompletedSets);
  const weeklyRpe = getWeeklyAverageRpe(filteredCompletedSets);
  const blockComparison = compareBlocks(filteredCompletedSets);
  const blockReport = getBlockReport(blockComparison);
  const phaseComparison = comparePhases(filteredCompletedSets);
  const consistency = getConsistencyCalendar(calendarWorkouts);
  const trainingFrequency = getTrainingFrequency(calendarWorkouts);
  const fatigueSignals = calculateFatigueSignals(filteredCompletedSets, calendarWorkouts);
  const fatigueReasons = getFatigueReasons(fatigueSignals);
  const completedMuscleExposure = calculateMuscleExposure(filteredCompletedSets);
  const plannedMuscleExposure = calculateMuscleExposure(filteredPlannedSets);
  const plannedActualMuscleGaps = comparePlannedActualMuscleExposure(
    plannedMuscleExposure,
    completedMuscleExposure,
  ).slice(0, 5);
  const muscleExposure = completedMuscleExposure
    .sort((a, b) => b.volumeLoad - a.volumeLoad)
    .slice(0, 5);
  const totalMuscleVolume = muscleExposure.reduce(
    (total, exposure) => total + exposure.volumeLoad,
    0,
  );
  const categoryDistribution = getCategoryDistribution(filteredCompletedSets);
  const muscleHeatmap = calculateMuscleHeatmap(completedMuscleExposure)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 8);
  const plannedMuscleHeatmap = calculateMuscleHeatmap(
    plannedMuscleExposure,
  )
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 8);
  const primaryStrengthTrend = strengthTrend.filter(
    (point) => point.exerciseId === strengthTrend[0]?.exerciseId,
  );
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
  const maxDuration = Math.max(
    ...sessionDurations.map((point) => point.durationSeconds),
    1,
  );
  const maxExposure = Math.max(
    ...muscleExposure.map((exposure) => exposure.volumeLoad),
    1,
  );
  const completed = consistency.reduce((sum, day) => sum + day.completed, 0);
  const missed = consistency.reduce((sum, day) => sum + day.missed, 0);
  const failedSets = filteredCompletedSets.filter((set) => set.failed === 1).length;
  const rirSets = filteredCompletedSets.filter((set) => set.rir !== null);
  const averageRir =
    rirSets.length === 0
      ? null
      : rirSets.reduce((total, set) => total + (set.rir ?? 0), 0) / rirSets.length;
  const topMuscle = muscleExposure[0] ?? null;

  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Analytics Preview</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {filteredCompletedSets.length}/{completedSets.length} completed sets in{' '}
        {formatHeatmapRange(heatmapRange).toLowerCase()} scope.
      </Text>
      <View style={styles.actionRow}>
        {(['year', 'week', 'block', 'phase', 'custom'] as const).map((range) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: heatmapRange === range }}
            key={range}
            onPress={() => setHeatmapRange(range)}
            style={[
              styles.secondaryButton,
              heatmapRange === range ? styles.selectedButton : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{formatHeatmapRange(range)}</Text>
          </Pressable>
        ))}
      </View>
      {heatmapRange === 'custom' ? (
        <View style={styles.setEntryRow}>
          <TextInput
            accessibilityLabel="Analytics start date"
            onChangeText={setCustomStartDate}
            placeholder="YYYY-MM-DD"
            style={[styles.baselineInput, styles.setEntryInput]}
            value={customStartDate}
          />
          <TextInput
            accessibilityLabel="Analytics end date"
            onChangeText={setCustomEndDate}
            placeholder="YYYY-MM-DD"
            style={[styles.baselineInput, styles.setEntryInput]}
            value={customEndDate}
          />
        </View>
      ) : null}
      <View style={styles.sessionPanel}>
        <Text style={styles.sessionTitle}>Selected Data Point</Text>
        <Text style={styles.summaryText}>{selectedInsight}</Text>
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Weekly Volume</Text>
        {weeklyVolume.length === 0 ? (
          <Text style={styles.summaryText}>No completed working sets yet.</Text>
        ) : (
          <>
            <VolumeTrendChart
              onSelect={(point) =>
                setSelectedInsight(
                  `Weekly volume ${point.weekKey}: ${point.totalVolume} kg reps across ${point.totalSets} working sets.`,
                )
              }
              points={weeklyVolume}
            />
            {weeklyVolume.map((point) => (
              <BarRow
                key={point.weekKey}
                label={point.weekKey}
                onPress={() =>
                  setSelectedInsight(
                    `Weekly volume ${point.weekKey}: ${point.totalVolume} kg reps across ${point.totalSets} working sets.`,
                  )
                }
                value={`${point.totalVolume} kg reps`}
                percent={(point.totalVolume / maxVolume) * 100}
              />
            ))}
          </>
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
              onPress={() =>
                setSelectedInsight(
                  `Weekly RPE ${point.weekKey}: ${Math.round(point.averageRpe * 10) / 10} average from ${point.ratedSets} rated working sets.`,
                )
              }
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
              label={`Block ${point.blockNumber} - ${formatPhaseLabel(point.phaseCode)}`}
              onPress={() =>
                setSelectedInsight(
                  `Block ${point.blockNumber} ${formatPhaseLabel(point.phaseCode)}: ${point.workingSets} working sets and ${point.totalVolume} kg reps.`,
                )
              }
              value={`${point.workingSets} sets`}
              percent={(point.totalVolume / maxBlockVolume) * 100}
            />
          ))
        )}
        {blockComparison.length > 0 ? (
          <View style={styles.sessionPanel}>
            <Text style={styles.sessionTitle}>Block Report</Text>
            <Text style={styles.setPrescription}>
              Highest volume: Block {blockReport.topVolume?.blockNumber ?? '-'} -{' '}
              {Math.round(blockReport.topVolume?.totalVolume ?? 0)} kg reps.
            </Text>
            <Text style={styles.setPrescription}>
              Most working sets: Block {blockReport.topSets?.blockNumber ?? '-'} -{' '}
              {blockReport.topSets?.workingSets ?? 0} sets. Average:{' '}
              {Math.round(blockReport.averageVolume)} kg reps /{' '}
              {Math.round(blockReport.averageWorkingSets)} sets.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Phase Comparison</Text>
        {phaseComparison.length === 0 ? (
          <Text style={styles.summaryText}>No completed phase data yet.</Text>
        ) : (
          phaseComparison.map((point) => (
            <BarRow
              key={point.phaseCode}
              label={formatPhaseLabel(point.phaseCode)}
              onPress={() =>
                setSelectedInsight(
                  `Phase ${formatPhaseLabel(point.phaseCode)}: ${point.workingSets} working sets and ${point.totalVolume} kg reps.`,
                )
              }
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
              onPress={() =>
                setSelectedInsight(
                  `Training frequency ${point.weekKey}: ${point.completed}/${point.scheduled} scheduled workouts completed.`,
                )
              }
              value={`${point.completed}/${point.scheduled} completed`}
              percent={(point.scheduled / maxFrequency) * 100}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Consistency Calendar</Text>
        {consistency.length === 0 ? (
          <Text style={styles.summaryText}>No scheduled training days yet.</Text>
        ) : (
          <CalendarHeatmap days={consistency.slice(-56)} />
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Planned vs Actual</Text>
        {plannedVsActual.length === 0 ? (
          <Text style={styles.summaryText}>No planned-versus-actual sessions yet.</Text>
        ) : (
          plannedVsActual.map((item) => (
            <PlannedActualRow
              key={item.instanceId}
              item={item}
              onPress={() =>
                setSelectedInsight(
                  `${item.workoutName} on ${item.scheduledDate}: ${item.actualWorkingSets}/${item.plannedWorkingSets} working sets completed.`,
                )
              }
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Session Duration</Text>
        {sessionDurations.length === 0 ? (
          <Text style={styles.summaryText}>No completed session durations yet.</Text>
        ) : (
          sessionDurations.map((point) => (
            <BarRow
              key={point.workoutLogId}
              label={point.workoutName}
              onPress={() =>
                setSelectedInsight(
                  `${point.workoutName}: ${formatDuration(point.durationSeconds)} completed on ${point.completedAt}.`,
                )
              }
              value={formatDuration(point.durationSeconds)}
              percent={(point.durationSeconds / maxDuration) * 100}
            />
          ))
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Fatigue Signals</Text>
        <Text style={styles.summaryText}>
          Current signal level: {fatigueSignals.riskLevel}. Derived from logged RPE,
          RIR, failed sets, missed sessions, and week-to-week volume change.
        </Text>
        <View style={styles.analyticsFooter}>
          <Metric label="Failed" value={String(fatigueSignals.failedSets)} />
          <Metric label="High RPE" value={String(fatigueSignals.highRpeSets)} />
          <Metric label="Low RIR" value={String(fatigueSignals.lowRirSets)} />
          <Metric label="Drops" value={String(fatigueSignals.performanceDropSignals)} />
        </View>
        <Text style={styles.setPrescription}>
          Latest week: {Math.round(fatigueSignals.latestWeekVolume)} kg reps - prior
          week: {Math.round(fatigueSignals.priorWeekVolume)} kg reps - missed:{' '}
          {fatigueSignals.missedSessions}.
        </Text>
        <Text style={styles.setPrescription}>
          Drivers: {fatigueReasons.length === 0 ? 'none detected' : fatigueReasons.join(', ')}.
        </Text>
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
              onPress={() =>
                setSelectedInsight(
                  `${muscleNameById.get(exposure.muscleId) ?? exposure.muscleId}: ${exposure.hardSets.toFixed(1)} hard sets and ${Math.round(exposure.volumeLoad)} kg reps.`,
                )
              }
              value={`${exposure.hardSets.toFixed(1)} hard sets`}
              percent={(exposure.volumeLoad / maxExposure) * 100}
            />
          ))
        )}
        {topMuscle ? (
          <Text style={styles.setPrescription}>
            Detail: {muscleNameById.get(topMuscle.muscleId) ?? topMuscle.muscleId} -{' '}
            {topMuscle.hardSets.toFixed(1)} hard sets - {Math.round(topMuscle.volumeLoad)} kg reps.
          </Text>
        ) : null}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Muscle Distribution</Text>
        {muscleExposure.length === 0 || totalMuscleVolume === 0 ? (
          <Text style={styles.summaryText}>No muscle distribution yet.</Text>
        ) : (
          <CompositionBar
            items={muscleExposure.map((exposure) => ({
              id: exposure.muscleId,
              label: muscleNameById.get(exposure.muscleId) ?? exposure.muscleId,
              value: exposure.volumeLoad,
            }))}
          />
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Exercise Category Distribution</Text>
        {categoryDistribution.length === 0 ? (
          <Text style={styles.summaryText}>No exercise category distribution yet.</Text>
        ) : (
          <CompositionBar items={categoryDistribution} />
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Muscle Heatmap</Text>
        {muscleHeatmap.length === 0 ? (
          <Text style={styles.summaryText}>No heatmap data from completed sets yet.</Text>
        ) : (
          <>
            <Text style={styles.setExercise}>Actual</Text>
            <View style={styles.heatmapFigures}>
              <MuscleHeatmapFigure
                onSelect={(region) =>
                  setSelectedInsight(
                    `Actual heatmap ${region.name}: ${region.hardSets.toFixed(1)} hard sets at ${Math.round(region.intensity * 100)}% relative intensity.`,
                  )
                }
                regions={muscleHeatmap}
                view="front"
              />
              <MuscleHeatmapFigure
                onSelect={(region) =>
                  setSelectedInsight(
                    `Actual heatmap ${region.name}: ${region.hardSets.toFixed(1)} hard sets at ${Math.round(region.intensity * 100)}% relative intensity.`,
                  )
                }
                regions={muscleHeatmap}
                view="back"
              />
            </View>
          </>
        )}
        {plannedMuscleHeatmap.length === 0 ? null : (
          <>
            <Text style={styles.setExercise}>Planned</Text>
            <View style={styles.heatmapFigures}>
              <MuscleHeatmapFigure
                onSelect={(region) =>
                  setSelectedInsight(
                    `Planned heatmap ${region.name}: ${region.hardSets.toFixed(1)} hard sets at ${Math.round(region.intensity * 100)}% relative intensity.`,
                  )
                }
                regions={plannedMuscleHeatmap}
                view="front"
              />
              <MuscleHeatmapFigure
                onSelect={(region) =>
                  setSelectedInsight(
                    `Planned heatmap ${region.name}: ${region.hardSets.toFixed(1)} hard sets at ${Math.round(region.intensity * 100)}% relative intensity.`,
                  )
                }
                regions={plannedMuscleHeatmap}
                view="back"
              />
            </View>
          </>
        )}
        {plannedActualMuscleGaps.length === 0 ? null : (
          <View style={styles.sessionPanel}>
            <Text style={styles.sessionTitle}>Planned vs Actual Muscle Gap</Text>
            {plannedActualMuscleGaps.map((gap) => (
              <Text key={gap.muscleId} style={styles.setPrescription}>
                {muscleNameById.get(gap.muscleId) ?? gap.muscleId}: actual{' '}
                {gap.actualHardSets.toFixed(1)} vs planned{' '}
                {gap.plannedHardSets.toFixed(1)} hard sets ({gap.hardSetDelta >= 0 ? '+' : ''}
                {gap.hardSetDelta.toFixed(1)}).
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Estimated 1RM Trend</Text>
        {strengthTrend.length === 0 ? (
          <Text style={styles.summaryText}>No estimated 1RM records yet.</Text>
        ) : (
          <>
            <StrengthTrendChart
              onSelect={(point) =>
                setSelectedInsight(
                  `${point.exerciseName}: estimated 1RM ${Math.round(point.estimatedOneRm * 10) / 10} ${point.unit ?? ''} on ${point.achievedAt}.`,
                )
              }
              points={primaryStrengthTrend.slice(0, 8)}
            />
            <Text style={styles.setPrescription}>
              Line: {primaryStrengthTrend[0]?.exerciseName}
            </Text>
            {strengthTrend.slice(0, 5).map((point) => (
              <Pressable
                accessibilityRole="button"
                key={`${point.exerciseId}_${point.achievedAt}`}
                onPress={() =>
                  setSelectedInsight(
                    `${point.exerciseName}: estimated 1RM ${Math.round(point.estimatedOneRm * 10) / 10} ${point.unit ?? ''} on ${point.achievedAt}.`,
                  )
                }
                style={styles.setRow}
              >
                <Text style={styles.setExercise}>{point.exerciseName}</Text>
                <Text style={styles.setPrescription}>
                  {Math.round(point.estimatedOneRm * 10) / 10} {point.unit ?? ''} -{' '}
                  {point.achievedAt}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View style={styles.analyticsFooter}>
        <Metric label="Completed" value={String(completed)} />
        <Metric label="Missed" value={String(missed)} />
        <Metric label="Failed Sets" value={String(failedSets)} />
        <Metric
          label="Avg RIR"
          value={averageRir === null ? '-' : String(Math.round(averageRir * 10) / 10)}
        />
      </View>
    </View>
  );
}

function HistorySummary({
  db,
  dbStatus,
  historyItems,
  onSaved,
  personalRecords,
}: {
  db: TrainingDatabase | null;
  dbStatus: string;
  historyItems: WorkoutHistoryItem[];
  onSaved: (database: TrainingDatabase) => Promise<void>;
  personalRecords: PersonalRecordItem[];
}) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [historySets, setHistorySets] = useState<WorkoutHistorySet[]>([]);
  const [historyEditValues, setHistoryEditValues] = useState<
    Record<string, { weight: string; reps: string; rpe: string; notes: string }>
  >({});
  const [historyStatus, setHistoryStatus] = useState('Select a workout to inspect sets');

  useEffect(() => {
    if (!db || !selectedLogId) {
      setHistorySets([]);
      return;
    }

    void getWorkoutHistorySets(db, selectedLogId).then((sets) => {
      setHistorySets(sets);
      setHistoryEditValues(
        Object.fromEntries(
          sets.map((set) => [
            set.setLogId,
            {
              weight: set.weight === null ? '' : String(set.weight),
              reps: set.reps === null ? '' : String(set.reps),
              rpe: set.rpe === null ? '' : String(set.rpe),
              notes: set.userNotes ?? '',
            },
          ]),
        ),
      );
      setHistoryStatus(`${sets.length} sets loaded`);
    });
  }, [db, selectedLogId]);

  const saveSetEdit = async (set: WorkoutHistorySet) => {
    if (!db || !selectedLogId) return;

    const values = historyEditValues[set.setLogId];
    if (!values) return;

    try {
      await updateWorkoutHistorySet(db, {
        workoutLogId: selectedLogId,
        setLogId: set.setLogId,
        weight: values.weight.trim() === '' ? null : Number(values.weight),
        reps: values.reps.trim() === '' ? null : Number(values.reps),
        rpe: values.rpe.trim() === '' ? null : Number(values.rpe),
        notes: values.notes.trim() || null,
      });
      const nextSets = await getWorkoutHistorySets(db, selectedLogId);
      setHistorySets(nextSets);
      await onSaved(db);
      setHistoryStatus('Set correction saved');
    } catch (error) {
      setHistoryStatus(error instanceof Error ? error.message : 'Correction failed');
    }
  };

  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Recent Workout Logs</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {historyItems.length} logs available.
      </Text>
      <Text style={styles.summaryText}>{historyStatus}</Text>
      <View style={styles.setPreview}>
        {historyItems.length === 0 ? (
          <Text style={styles.summaryText}>No saved workout logs yet.</Text>
        ) : (
          historyItems.map((item) => (
            <View key={item.workoutLogId} style={styles.setRow}>
              <Text style={styles.setExercise}>{item.workoutName}</Text>
              <Text style={styles.setPrescription}>
                {formatCleanLabel(item.status)} - {item.completedAt ?? item.scheduledDate} -{' '}
                {item.totalWorkingSets ?? 0} working sets - {item.totalVolume ?? 0} kg reps
                {item.durationSeconds !== null
                  ? ` - ${formatDuration(item.durationSeconds)}`
                  : ''}
                {item.personalRecordCount > 0 ? ` - ${item.personalRecordCount} PRs` : ''}
                {item.failedSetCount > 0 ? ` - ${item.failedSetCount} failed sets` : ''}
              </Text>
              {item.lastSetNote ? (
                <Text style={styles.setPrescription}>Note: {item.lastSetNote}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setSelectedLogId((current) =>
                    current === item.workoutLogId ? null : item.workoutLogId,
                  )
                }
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {selectedLogId === item.workoutLogId ? 'Hide Detail' : 'Workout Detail'}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
      {selectedLogId ? (
        <View style={styles.baselinePanel}>
          <Text style={styles.summaryTitle}>Workout Detail</Text>
          {historySets.length === 0 ? (
            <Text style={styles.summaryText}>No set rows found for this workout.</Text>
          ) : (
            historySets.map((set) => {
              const values = historyEditValues[set.setLogId] ?? {
                weight: '',
                reps: '',
                rpe: '',
                notes: '',
              };

              return (
                <View key={set.setLogId} style={styles.setRow}>
                  <Text style={styles.setExercise}>{set.exerciseName}</Text>
                  <Text style={styles.setPrescription}>
                    Set {set.setOrder} - {formatCleanLabel(set.setType)}
                    {set.isCompleted ? ' - completed' : ' - not completed'}
                    {set.isFailed ? ' - failed' : ''}
                  </Text>
                  <View style={styles.setEntryRow}>
                    <TextInput
                      accessibilityLabel={`History weight for ${set.exerciseName}`}
                      inputMode="decimal"
                      onChangeText={(weight) =>
                        setHistoryEditValues((current) => ({
                          ...current,
                          [set.setLogId]: { ...values, weight },
                        }))
                      }
                      placeholder={set.unit}
                      style={[styles.noteInput, styles.setEntryInput]}
                      value={values.weight}
                    />
                    <TextInput
                      accessibilityLabel={`History reps for ${set.exerciseName}`}
                      inputMode="numeric"
                      onChangeText={(reps) =>
                        setHistoryEditValues((current) => ({
                          ...current,
                          [set.setLogId]: { ...values, reps },
                        }))
                      }
                      placeholder="Reps"
                      style={[styles.noteInput, styles.setEntryInput]}
                      value={values.reps}
                    />
                    <TextInput
                      accessibilityLabel={`History RPE for ${set.exerciseName}`}
                      inputMode="decimal"
                      onChangeText={(rpe) =>
                        setHistoryEditValues((current) => ({
                          ...current,
                          [set.setLogId]: { ...values, rpe },
                        }))
                      }
                      placeholder="RPE"
                      style={[styles.noteInput, styles.setEntryInput]}
                      value={values.rpe}
                    />
                  </View>
                  <TextInput
                    accessibilityLabel={`History note for ${set.exerciseName}`}
                    onChangeText={(notes) =>
                      setHistoryEditValues((current) => ({
                        ...current,
                        [set.setLogId]: { ...values, notes },
                      }))
                    }
                    placeholder="Set note"
                    style={styles.noteInput}
                    value={values.notes}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void saveSetEdit(set)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Save Correction</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      ) : null}
      <View style={styles.baselinePanel}>
        <Text style={styles.summaryTitle}>Personal Records</Text>
        {personalRecords.length === 0 ? (
          <Text style={styles.summaryText}>No personal records saved yet.</Text>
        ) : (
          <>
            <PrHistoryChart records={personalRecords.slice(0, 8)} />
            {personalRecords.map((record) => (
              <View key={record.recordId} style={styles.setRow}>
                <Text style={styles.setExercise}>{record.exerciseName}</Text>
                <Text style={styles.setPrescription}>
                  {formatPersonalRecord(record)} - {record.achievedAt}
                </Text>
              </View>
            ))}
          </>
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
  notificationSettings,
  onSaved,
}: {
  calendarWorkouts: CalendarWorkout[];
  db: TrainingDatabase | null;
  dbStatus: string;
  missedWorkouts: MissedWorkoutItem[];
  notificationSettings: NotificationSettings;
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
  const scheduleMissedReminders = async () => {
    if (!db || missedWorkouts.length === 0) return;

    let scheduled = 0;
    for (const workout of missedWorkouts) {
      const notification = planNextMissedWorkoutNotification(
        new Date(),
        workout.workoutName,
        notificationSettings,
      );
      if (!notification) continue;

      const externalNotificationId = await scheduleLocalNotification(notification);
      if (!externalNotificationId) continue;

      await savePlannedNotification(
        db,
        notification,
        workout.instanceId,
        externalNotificationId,
      );
      scheduled += 1;
    }
    await onSaved(db);
    setStatus(
      scheduled === 0
        ? 'No missed reminders scheduled'
        : `${scheduled} missed reminder${scheduled === 1 ? '' : 's'} scheduled`,
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
      <Pressable
        accessibilityRole="button"
        onPress={() => void scheduleMissedReminders()}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Schedule Missed Reminders</Text>
      </Pressable>
      <View style={styles.setPreview}>
        {missedWorkouts.length === 0 ? (
          <Text style={styles.summaryText}>No missed sessions need a decision.</Text>
        ) : (
          missedWorkouts.map((workout) => (
            <View key={workout.instanceId} style={styles.setRow}>
              <Text style={styles.setExercise}>{workout.workoutName}</Text>
              <Text style={styles.setPrescription}>
                {workout.scheduledDate} - {formatCleanLabel(workout.status)}
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
  const [draftBarbellWeight, setDraftBarbellWeight] = useState('');
  const [draftPlateIncrement, setDraftPlateIncrement] = useState('');
  const [draftDumbbellIncrement, setDraftDumbbellIncrement] = useState('');
  const [draftMachineIncrement, setDraftMachineIncrement] = useState('');
  const [draftWorkoutReminderTime, setDraftWorkoutReminderTime] = useState('');
  const [draftMissedReminderTime, setDraftMissedReminderTime] = useState('');
  const [customAlternativeNames, setCustomAlternativeNames] = useState<
    Record<string, string>
  >({});
  const [restoreJson, setRestoreJson] = useState('');
  const [restorePreview, setRestorePreview] =
    useState<TrainingDataExportPreview | null>(null);
  const [backupSyncStatus, setBackupSyncStatus] = useState<BackupSyncStatus | null>(
    null,
  );
  const [resetConfirm, setResetConfirm] = useState('');
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
  const savedBaselineCount = baselineExercises.filter((exercise) =>
    recordByExercise.has(exercise.exerciseId),
  ).length;
  const phaseTransition = getPhaseTransitionSummary(position, oneRmRecords);
  const setupChecks = [
    {
      label: 'Annual calendar',
      done: exercises.length > 0,
      detail: `${exercises.length} exercises loaded`,
    },
    {
      label: 'Equipment settings',
      done:
        appSettings.barbellWeight > 0 &&
        appSettings.plateIncrement > 0 &&
        appSettings.dumbbellIncrement > 0 &&
        appSettings.machineIncrement > 0,
      detail: `${appSettings.preferredUnit}, ${appSettings.plateIncrement} plate increment`,
    },
    {
      label: '1RM baselines',
      done: savedBaselineCount >= 3,
      detail: `${savedBaselineCount}/${baselineExercises.length} visible lifts saved`,
    },
    {
      label: 'Reminders',
      done:
        notificationSettings.workoutRemindersEnabled &&
        notificationSettings.missedWorkoutEnabled,
      detail: `${notificationSettings.workoutReminderTime ?? 'unset'} workout, ${
        notificationSettings.missedWorkoutTime ?? 'unset'
      } missed`,
    },
    {
      label: 'Backup',
      done: false,
      detail: 'Use Export Data after setup or restore a pasted backup',
    },
  ];
  const saveBaseline = async (
    exerciseId: string,
    recordType: 'current_working' | 'tested' | 'phase_end' = 'current_working',
  ) => {
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
      recordType,
      programBlockId:
        position.status === 'in_year' ? `block_${position.week.blockNumber}` : null,
    });
    await onSaved(db);
    setSaveStatus(`${formatOneRmRecordType(recordType)} saved locally`);
  };
  const transferBaseline = async (record: CurrentOneRmRecord | undefined) => {
    if (!db) return;
    if (!record) {
      setSaveStatus('No tested or phase-end 1RM to transfer');
      return;
    }
    if (position.status !== 'in_year') {
      setSaveStatus('Training year is not active');
      return;
    }

    try {
      const next = transferPhaseEndToBlockBaseline(
        record,
        `block_${position.week.blockNumber + 1}`,
        new Date().toISOString(),
      );
      await saveOneRmRecord(db, {
        exerciseId: next.exerciseId,
        value: next.value,
        unit: next.unit,
        recordType: next.recordType,
        programBlockId: next.programBlockId,
        recordedAt: next.recordedAt,
      });
      await onSaved(db);
      setSaveStatus('Next block baseline saved locally');
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : 'Cannot transfer baseline',
      );
    }
  };
  const confirmPhaseTransitionBaselines = async () => {
    if (!db || !phaseTransition) return;
    if (oneRmRecords.length === 0) {
      setSaveStatus('Save at least one 1RM before confirming baselines');
      return;
    }

    const recordedAt = new Date().toISOString();
    for (const record of oneRmRecords) {
      await saveOneRmRecord(db, {
        exerciseId: record.exerciseId,
        value: record.value,
        unit: record.unit,
        recordType: 'block_baseline',
        programBlockId: phaseTransition.nextBlockId,
        recordedAt,
      });
    }
    await onSaved(db);
    setSaveStatus(
      `Confirmed ${oneRmRecords.length} baselines for Block ${phaseTransition.nextBlockNumber}`,
    );
  };
  const saveSettings = async (settings: Partial<AppSettings>) => {
    if (!db) return;

    try {
      await saveAppSettings(db, { ...appSettings, ...settings });
      await onSaved(db);
      setDraftBarbellWeight('');
      setDraftPlateIncrement('');
      setDraftDumbbellIncrement('');
      setDraftMachineIncrement('');
      setSaveStatus('Settings saved locally');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Invalid settings');
    }
  };
  const applyRecommendedSetup = async () => {
    if (!db) return;

    await saveAppSettings(db, appSettings);
    await saveNotificationSettings(db, notificationSettings);
    await onSaved(db);
    setSaveStatus('Recommended setup saved locally');
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
  const createCustomAlternative = async (exercise: ExerciseLibraryItem) => {
    if (!db) return;

    try {
      await saveCustomAlternative(db, {
        sourceExerciseId: exercise.exerciseId,
        name: customAlternativeNames[exercise.exerciseId] ?? '',
      });
      setCustomAlternativeNames((current) => ({
        ...current,
        [exercise.exerciseId]: '',
      }));
      await onSaved(db);
      setSaveStatus(`Custom alternative saved for ${exercise.name}`);
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : 'Custom alternative failed',
      );
    }
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
      | 'unfinishedSessionEnabled'
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
  const scheduleWeekStatusReminder = async () => {
    if (!db) return;

    const notification = planNextWeekStatusNotification(
      new Date(),
      position,
      notificationSettings,
    );
    if (!notification) {
      setSaveStatus('No deload, taper, or test reminder due');
      return;
    }

    const externalNotificationId = await scheduleLocalNotification(notification);
    if (!externalNotificationId) {
      setSaveStatus('Notification permission denied or time has passed');
      return;
    }

    await savePlannedNotification(db, notification, null, externalNotificationId);
    await onSaved(db);
    setSaveStatus('Week status reminder scheduled');
  };
  const exportTrainingData = async () => {
    if (!db) return;

    const directory = new Directory(Paths.document, 'exports');
    directory.create({ idempotent: true, intermediates: true });

    const snapshot = await getTrainingDataExport(db);
    const files = buildExportFiles(snapshot);
    for (const exportFile of files) {
      const file = new File(directory, exportFile.name);
      file.create({ overwrite: true });
      file.write(exportFile.content);
    }
    setBackupSyncStatus(
      getBackupSyncStatus({
        exportedAt: snapshot.exportedAt,
        schemaVersion: snapshot.schemaVersion,
        totalRows: Object.values(snapshot.tables).reduce(
          (sum, rows) => sum + rows.length,
          0,
        ),
      }),
    );
    setSaveStatus(`Exported ${files.length} files to ${directory.uri}`);
  };
  const updateRestoreJson = (json: string) => {
    setRestoreJson(json);
    setRestorePreview(null);
  };
  const pickRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: 'application/json',
      });
      if (result.canceled) {
        setSaveStatus('Backup import canceled');
        return;
      }

      const asset = result.assets[0];
      const content = await new File(asset.uri).text();
      const preview = previewTrainingDataExport(content);
      setRestoreJson(content);
      setRestorePreview(preview);
      setBackupSyncStatus(getBackupSyncStatus(preview));
      setSaveStatus(`Loaded ${asset.name}`);
    } catch (error) {
      setRestorePreview(null);
      setSaveStatus(error instanceof Error ? error.message : 'Backup import failed');
    }
  };
  const previewRestoreBackup = () => {
    try {
      const preview = previewTrainingDataExport(restoreJson);
      setRestorePreview(preview);
      setBackupSyncStatus(getBackupSyncStatus(preview));
      setSaveStatus('Backup preview ready');
    } catch (error) {
      setRestorePreview(null);
      setSaveStatus(error instanceof Error ? error.message : 'Backup preview failed');
    }
  };
  const restoreTrainingData = async () => {
    if (!db) return;
    if (!restorePreview) {
      setSaveStatus('Preview backup before restoring');
      return;
    }

    try {
      await restoreTrainingDataExport(db, restoreJson);
      setRestoreJson('');
      setRestorePreview(null);
      setBackupSyncStatus(null);
      await onSaved(db);
      setSaveStatus('Backup restored locally');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Restore failed');
    }
  };
  const resetTrainingData = async () => {
    if (!db) return;
    if (resetConfirm !== 'RESET') {
      setSaveStatus('Type RESET to clear local training data');
      return;
    }

    await resetUserTrainingData(db);
    setResetConfirm('');
    await onSaved(db);
    setSaveStatus('Local training data reset');
  };
  const resetNotifications = async () => {
    if (!db) return;

    await resetNotificationData(db);
    await onSaved(db);
    setSaveStatus('Notification schedules and settings reset');
  };

  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryTitle}>Exercise Library</Text>
      <Text style={styles.summaryText}>
        {dbStatus} - {exercises.length} exercises loaded.
      </Text>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Setup Checklist</Text>
        <Text style={styles.summaryText}>
          Setup covers program data, units, plate increments, baselines, reminders, and backup.
        </Text>
        {setupChecks.map((check) => (
          <Text key={check.label} style={styles.setPrescription}>
            {check.done ? 'Done' : 'Pending'} - {check.label}: {check.detail}
          </Text>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => void applyRecommendedSetup()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Apply Recommended Setup</Text>
        </Pressable>
      </View>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Training Settings</Text>
        <Text style={styles.summaryText}>
          Unit: {appSettings.preferredUnit} - Barbell: {appSettings.barbellWeight} - Plate:{' '}
          {appSettings.plateIncrement} - Dumbbell: {appSettings.dumbbellIncrement} - Machine:{' '}
          {appSettings.machineIncrement}
        </Text>
        <Text style={styles.setPrescription}>
          Calendar: {formatCalendarMode(appSettings.calendarMode)} - rest sound:{' '}
          {appSettings.restAlertSound ? 'on' : 'off'} - rest vibration:{' '}
          {appSettings.restAlertVibration ? 'on' : 'off'} - theme:{' '}
          {appSettings.theme === 'scholar_dark' ? 'dark' : 'light'}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({
                theme:
                  appSettings.theme === 'scholar_dark'
                    ? 'scholar_light'
                    : 'scholar_dark',
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Dark Mode</Text>
          </Pressable>
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
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({
                calendarMode:
                  appSettings.calendarMode === 'program_week'
                    ? 'calendar_month'
                    : 'program_week',
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Calendar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({ restAlertSound: !appSettings.restAlertSound })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Rest Sound</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({
                restAlertVibration: !appSettings.restAlertVibration,
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Rest Vibration</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Barbell weight"
            inputMode="decimal"
            onChangeText={setDraftBarbellWeight}
            placeholder={String(appSettings.barbellWeight)}
            style={styles.baselineInput}
            value={draftBarbellWeight}
          />
          <TextInput
            accessibilityLabel="Plate increment"
            inputMode="decimal"
            onChangeText={setDraftPlateIncrement}
            placeholder={String(appSettings.plateIncrement)}
            style={styles.baselineInput}
            value={draftPlateIncrement}
          />
          <TextInput
            accessibilityLabel="Dumbbell increment"
            inputMode="decimal"
            onChangeText={setDraftDumbbellIncrement}
            placeholder={String(appSettings.dumbbellIncrement)}
            style={styles.baselineInput}
            value={draftDumbbellIncrement}
          />
          <TextInput
            accessibilityLabel="Machine increment"
            inputMode="decimal"
            onChangeText={setDraftMachineIncrement}
            placeholder={String(appSettings.machineIncrement)}
            style={styles.baselineInput}
            value={draftMachineIncrement}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void saveSettings({
                barbellWeight: Number(
                  draftBarbellWeight || appSettings.barbellWeight,
                ),
                plateIncrement: Number(
                  draftPlateIncrement || appSettings.plateIncrement,
                ),
                dumbbellIncrement: Number(
                  draftDumbbellIncrement || appSettings.dumbbellIncrement,
                ),
                machineIncrement: Number(
                  draftMachineIncrement || appSettings.machineIncrement,
                ),
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Save Equipment</Text>
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
          {notificationSettings.testWeekRemindersEnabled ? 'on' : 'off'} - Unfinished:{' '}
          {notificationSettings.unfinishedSessionEnabled ? 'on' : 'off'}
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
            onPress={() => void toggleNotificationSetting('unfinishedSessionEnabled')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Toggle Unfinished</Text>
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
          <Pressable
            accessibilityRole="button"
            onPress={() => void scheduleWeekStatusReminder()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Schedule Week</Text>
          </Pressable>
        </View>
        {scheduledNotifications.slice(0, 3).map((notification) => (
          <Text key={notification.id} style={styles.setPrescription}>
            {notification.title} - {notification.scheduledFor} - opens{' '}
            {formatNotificationRoute(notification.route)}
          </Text>
        ))}
      </View>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Backup and Export</Text>
        <Text style={styles.summaryText}>
          Export local training data as one JSON backup plus workout, set, and PR CSV files.
          Preview a backup before restoring because restore replaces local logs and settings.
        </Text>
        <Text style={styles.setPrescription}>
          Sync status:{' '}
          {backupSyncStatus
            ? `${backupSyncStatus.summary} - ${backupSyncStatus.exportedAt}`
            : 'no backup previewed or exported this session'}
        </Text>
        <TextInput
          accessibilityLabel="Restore backup JSON"
          multiline
          onChangeText={updateRestoreJson}
          placeholder="Paste exported JSON backup"
          style={styles.noteInput}
          value={restoreJson}
        />
        {restorePreview ? (
          <View style={styles.sessionPanel}>
            <Text style={styles.sessionTitle}>Restore Preview</Text>
            <Text style={styles.setPrescription}>
              Exported: {restorePreview.exportedAt} - schema {restorePreview.schemaVersion}
            </Text>
            <Text style={styles.setPrescription}>
              Rows: {restorePreview.totalRows} total - workouts{' '}
              {restorePreview.tableCounts.workout_logs} - sets{' '}
              {restorePreview.tableCounts.set_logs} - 1RM records{' '}
              {restorePreview.tableCounts.one_rm_records} - personal records{' '}
              {restorePreview.tableCounts.personal_records}
            </Text>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Reset confirmation"
          onChangeText={setResetConfirm}
          placeholder="Type RESET to clear logs"
          style={styles.baselineInput}
          value={resetConfirm}
        />
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void exportTrainingData()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Export Data</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void pickRestoreBackup()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Import File</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: restoreJson.trim() === '' }}
            disabled={restoreJson.trim() === ''}
            onPress={previewRestoreBackup}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Preview Backup</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !restorePreview }}
            disabled={!restorePreview}
            onPress={() => void restoreTrainingData()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Restore Backup</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void resetTrainingData()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Reset Logs</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void resetNotifications()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Reset Notifications</Text>
          </Pressable>
        </View>
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
                {formatCleanLabel(exercise.movementPattern)} -{' '}
                {formatCleanLabel(exercise.defaultRole ?? 'general')} -{' '}
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
                    {formatReplacementScope(
                      replacementByExercise.get(exercise.exerciseId)?.scope ?? 'today_only',
                    )} - restore
                  </Text>
                </Pressable>
              ) : null}
              {(alternativesByExercise.get(exercise.exerciseId) ?? [])
                .slice(0, 2)
                .map((alternative, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={alternative.alternativeExerciseId}
                    onPress={() => void saveReplacement(alternative)}
                  >
                    <Text style={styles.setPrescription}>
                      {index === 0 ? 'Suggested' : 'Alternative'}:{' '}
                      {alternative.alternativeName} - {alternative.compatibilityScore}%
                      match{alternative.reason ? ` - ${alternative.reason}` : ''}
                    </Text>
                  </Pressable>
                ))}
              {(alternativesByExercise.get(exercise.exerciseId) ?? []).length === 0 ? (
                <Text style={styles.warningText}>No approved alternative found</Text>
              ) : null}
              <View style={styles.setEntryRow}>
                <TextInput
                  accessibilityLabel={`Custom alternative for ${exercise.name}`}
                  onChangeText={(value) =>
                    setCustomAlternativeNames((current) => ({
                      ...current,
                      [exercise.exerciseId]: value,
                    }))
                  }
                  placeholder="Custom faithful alternative"
                  style={[styles.baselineInput, styles.setEntryInput]}
                  value={customAlternativeNames[exercise.exerciseId] ?? ''}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void createCustomAlternative(exercise)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Save Alternative</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
      <View style={styles.baselinePanel}>
        <Text style={styles.sessionTitle}>Current Working 1RM</Text>
        <Text style={styles.summaryText}>{saveStatus}</Text>
        {phaseTransition ? (
          <View style={styles.sessionPanel}>
            <Text style={styles.sessionTitle}>Phase Transition</Text>
            <Text style={styles.summaryText}>
              Block {phaseTransition.sourceBlockNumber} complete. Confirm baselines
              for Block {phaseTransition.nextBlockNumber} repeat loading.
            </Text>
            <Text style={styles.setPrescription}>
              {phaseTransition.baselineCount} current baselines -{' '}
              {phaseTransition.testedCount} tested - {phaseTransition.phaseEndCount}{' '}
              phase-end.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void confirmPhaseTransitionBaselines()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Confirm Repeat Baselines</Text>
            </Pressable>
          </View>
        ) : null}
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
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveBaseline(exercise.exerciseId, 'tested')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Tested</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveBaseline(exercise.exerciseId, 'phase_end')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Phase End</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void transferBaseline(record)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Transfer</Text>
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
  onPress,
  value,
  percent,
}: {
  label: string;
  onPress?: () => void;
  value: string;
  percent: number;
}) {
  const content = (
    <>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(percent, 4)}%` }]} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.barRow}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.barRow}>
      {content}
    </View>
  );
}

function CalendarHeatmap({ days }: { days: CalendarDay[] }) {
  return (
    <View>
      <View accessibilityLabel="Training consistency calendar heatmap" style={styles.calendarGrid}>
        {days.map((day) => (
          <View
            key={day.date}
            accessible
            accessibilityLabel={formatCalendarDayLabel(day)}
            style={[
              styles.calendarCell,
              { backgroundColor: getCalendarCellColor(day) },
            ]}
          />
        ))}
      </View>
      <Text style={styles.setPrescription}>
        Dark: completed - amber: missed - gray: skipped or moved. Latest {days.length}{' '}
        scheduled days shown.
      </Text>
    </View>
  );
}

function VolumeTrendChart({
  onSelect,
  points,
}: {
  onSelect?: (point: ReturnType<typeof getWeeklyVolume>[number]) => void;
  points: ReturnType<typeof getWeeklyVolume>;
}) {
  const [width, setWidth] = useState(0);
  const height = 96;
  const plot = getLineChartPlot(
    points.map((point) => ({
      label: point.weekKey,
      value: point.totalVolume,
    })),
    width,
    height,
  );

  return (
    <View
      accessibilityLabel={`Weekly volume line chart with ${points.length} weeks`}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.lineChart, { height }]}
    >
      <View style={styles.lineChartAxis} />
      {plot.slice(0, -1).map((point, index) => {
        const next = plot[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = `${Math.atan2(dy, dx)}rad`;

        return (
          <View
            key={`${point.label}_${index}_volume_line`}
            style={[
              styles.lineChartSegment,
              {
                left: (point.x + next.x) / 2 - length / 2,
                top: (point.y + next.y) / 2,
                width: length,
                transform: [{ rotate: angle }],
              },
            ]}
          />
        );
      })}
      {plot.map((point, index) => {
        const source = points[index];

        return (
          <Pressable
            accessibilityLabel={`${point.label}: ${Math.round(point.value)} kg reps`}
            accessibilityRole="button"
            hitSlop={12}
            key={`${point.label}_volume_point`}
            onPress={() => onSelect?.(source)}
            style={[styles.lineChartPoint, { left: point.x - 4, top: point.y - 4 }]}
          />
        );
      })}
    </View>
  );
}

function PrHistoryChart({ records }: { records: PersonalRecordItem[] }) {
  const [width, setWidth] = useState(0);
  const height = 96;
  const ordered = [...records].reverse();
  const plot = getLineChartPlot(
    ordered.map((record) => ({
      label: record.exerciseName,
      value: getPersonalRecordChartValue(record),
    })),
    width,
    height,
  );

  return (
    <View
      accessibilityLabel={`Personal record history line chart with ${records.length} records`}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.lineChart, { height }]}
    >
      <View style={styles.lineChartAxis} />
      {plot.slice(0, -1).map((point, index) => {
        const next = plot[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = `${Math.atan2(dy, dx)}rad`;

        return (
          <View
            key={`${point.label}_${index}_pr_line`}
            style={[
              styles.lineChartSegment,
              {
                left: (point.x + next.x) / 2 - length / 2,
                top: (point.y + next.y) / 2,
                width: length,
                transform: [{ rotate: angle }],
              },
            ]}
          />
        );
      })}
      {plot.map((point, index) => (
        <View
          key={`${point.label}_${index}_pr_point`}
          accessible
          accessibilityLabel={`${point.label}: ${Math.round(point.value * 10) / 10}`}
          style={[styles.lineChartPoint, { left: point.x - 4, top: point.y - 4 }]}
        />
      ))}
    </View>
  );
}

function StrengthTrendChart({
  onSelect,
  points,
}: {
  onSelect?: (point: StrengthTrendPoint) => void;
  points: StrengthTrendPoint[];
}) {
  const [width, setWidth] = useState(0);
  const height = 96;
  const ordered = [...points].reverse();
  const plot = getLineChartPlot(
    ordered.map((point) => ({
      label: point.exerciseName,
      value: point.estimatedOneRm,
    })),
    width,
    height,
  );

  return (
    <View
      accessibilityLabel={`Estimated 1RM line chart with ${points.length} records`}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.lineChart, { height }]}
    >
      <View style={styles.lineChartAxis} />
      {plot.slice(0, -1).map((point, index) => {
        const next = plot[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = `${Math.atan2(dy, dx)}rad`;

        return (
          <View
            key={`${point.label}_${index}_line`}
            style={[
              styles.lineChartSegment,
              {
                left: (point.x + next.x) / 2 - length / 2,
                top: (point.y + next.y) / 2,
                width: length,
                transform: [{ rotate: angle }],
              },
            ]}
          />
        );
      })}
      {plot.map((point, index) => {
        const source = ordered[index];

        return (
          <Pressable
            accessibilityLabel={`${point.label}: ${Math.round(point.value * 10) / 10}`}
            accessibilityRole="button"
            hitSlop={12}
            key={`${point.label}_${index}_point`}
            onPress={() => onSelect?.(source)}
            style={[styles.lineChartPoint, { left: point.x - 4, top: point.y - 4 }]}
          />
        );
      })}
    </View>
  );
}

function MuscleHeatmapFigure({
  onSelect,
  regions,
  view,
}: {
  onSelect?: (region: MuscleHeatmapRegion) => void;
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
            <Pressable
              accessibilityLabel={`${region.name}: ${region.hardSets.toFixed(1)} hard sets`}
              accessibilityRole="button"
              hitSlop={8}
              key={`${view}_${region.muscleId}`}
              onPress={() => onSelect?.(region)}
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
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

function getCalendarCellColor(day: CalendarDay) {
  if (day.completed > 0) return '#1E3A5F';
  if (day.missed > 0) return '#92400E';
  if (day.skipped > 0 || day.rescheduled > 0) return '#94A3B8';
  return '#E2E8F0';
}

function CompositionBar({
  items,
}: {
  items: { id: string; label: string; value: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <View>
      <View accessibilityLabel="Muscle distribution composition" style={styles.compositionTrack}>
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.compositionSegment,
              {
                flex: item.value,
                backgroundColor: compositionColors[index % compositionColors.length],
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.compositionLegend}>
        {items.map((item, index) => (
          <View key={item.id} style={styles.compositionLegendItem}>
            <View
              style={[
                styles.compositionSwatch,
                { backgroundColor: compositionColors[index % compositionColors.length] },
              ]}
            />
            <Text style={styles.setPrescription}>
              {item.label}: {Math.round((item.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlannedActualRow({
  item,
  onPress,
}: {
  item: PlannedVsActualWorkout;
  onPress?: () => void;
}) {
  const maxSets = Math.max(item.plannedWorkingSets, item.actualWorkingSets, 1);
  const content = (
    <>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{item.workoutName}</Text>
        <Text style={styles.barValue}>
          {item.actualWorkingSets}/{item.plannedWorkingSets} sets
        </Text>
      </View>
      <View accessibilityLabel="Planned versus actual working sets" style={styles.stackedTrack}>
        <View
          style={[
            styles.plannedSegment,
            { flex: Math.max(item.plannedWorkingSets, 0.1) / maxSets },
          ]}
        />
        <View
          style={[
            styles.actualSegment,
            { flex: Math.max(item.actualWorkingSets, 0.1) / maxSets },
          ]}
        />
      </View>
      <Text style={styles.setPrescription}>{item.scheduledDate}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.barRow}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.barRow}>
      {content}
    </View>
  );
}

function getHeatmapFilter(
  range: HeatmapRange,
  position: ProgramPosition,
  customStartDate: string,
  customEndDate: string,
): AnalyticsSetFilter {
  if (range === 'custom') {
    return isIsoDate(customStartDate) && isIsoDate(customEndDate)
      ? { mode: 'date_range', fromDate: customStartDate, toDate: customEndDate }
      : { mode: 'date_range', fromDate: '9999-12-31', toDate: '0000-01-01' };
  }

  if (position.status !== 'in_year') return { mode: 'all' };

  if (range === 'week') {
    return {
      mode: 'date_range',
      fromDate: position.week.startDate,
      toDate: position.week.endDate,
    };
  }
  if (range === 'block') {
    return { mode: 'block', blockNumber: position.week.blockNumber };
  }
  if (range === 'phase' && position.week.phaseCode) {
    return { mode: 'phase', phaseCode: position.week.phaseCode };
  }

  return { mode: 'all' };
}

function formatHeatmapRange(range: HeatmapRange) {
  return {
    year: 'Year',
    week: 'Week',
    block: 'Block',
    phase: 'Phase',
    custom: 'Custom',
  }[range];
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getCategoryDistribution(completedSets: AnalyticsSet[]) {
  const volumeByCategory = new Map<string, number>();
  for (const set of completedSets) {
    const category = set.exerciseCategory ?? 'Uncategorized';
    volumeByCategory.set(
      category,
      (volumeByCategory.get(category) ?? 0) + (set.weight ?? 0) * (set.reps ?? 0),
    );
  }

  return [...volumeByCategory.entries()]
    .map(([id, value]) => ({ id, label: formatCategoryLabel(id), value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function formatCategoryLabel(category: string) {
  return category
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCleanLabel(value: string | null | undefined) {
  if (!value) return '';
  const acronyms = new Set(['rm', 'rpe', 'rir', 'pr', 'amrap']);
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (acronyms.has(lower)) return lower.toUpperCase();
      return lower.slice(0, 1).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function formatPhaseLabel(value: string | null | undefined) {
  const match = value?.match(/^phase(\d+)$/i);
  if (match) return `Phase ${match[1]}`;
  return formatCleanLabel(value);
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

function formatRestRange(low: number | null, high: number | null) {
  if (low === null && high === null) return '';
  if (low === high) return ` - Rest ${formatDuration(low ?? 0)}`;
  return ` - Rest ${formatDuration(low ?? high ?? 0)}-${formatDuration(high ?? low ?? 0)}`;
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

function formatPlannedExerciseSummary(
  sets: readonly PlannedSet[],
  oneRmRecords: readonly CurrentOneRmRecord[],
  plateIncrement: number,
  unit: AppSettings['preferredUnit'],
) {
  const parts = [
    `${sets.length} sets`,
    formatUnique(sets.map((set) => formatCleanLabel(set.setType))),
    formatUnique(sets.map((set) => (set.targetReps ? `${set.targetReps} reps` : ''))),
    formatUnique(
      sets.map((set) =>
        formatPercentRange(set.percent1RmLow, set.percent1RmHigh).replace(/^ - /, ''),
      ),
    ),
    formatUnique(
      sets.map((set) =>
        formatSuggestedLoad(
          getSuggestedLoad(set, oneRmRecords, plateIncrement),
          unit,
        ).replace(/^ - /, ''),
      ),
    ),
    formatUnique(
      sets.map((set) =>
        formatRpeRange(set.targetRpeLow, set.targetRpeHigh).replace(/^ - /, ''),
      ),
    ),
    formatUnique(
      sets.map((set) =>
        formatRestRange(set.restSecondsMin, set.restSecondsMax).replace(/^ - /, ''),
      ),
    ),
  ].filter(Boolean);

  return parts.join(' - ');
}

function formatUnique(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean))).join(', ');
}

function formatOneRmRecordType(type: 'current_working' | 'tested' | 'phase_end') {
  if (type === 'current_working') return 'Current working 1RM';
  if (type === 'tested') return 'Tested 1RM';
  return 'Phase-end 1RM';
}

function getPersonalRecordChartValue(record: PersonalRecordItem) {
  return (
    record.estimatedOneRm ??
    record.volume ??
    record.weight ??
    record.reps ??
    0
  );
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

function formatReplacementScope(scope: ExerciseReplacementInput['scope'] | string) {
  if (scope === 'today_only') return 'Today';
  if (scope === 'week') return 'Week';
  if (scope === 'future_matching_in_block') return 'Future Block Matches';
  if (scope === 'block') return 'Block';
  return 'Year';
}

function formatCalendarMode(mode: AppSettings['calendarMode']) {
  return mode === 'program_week' ? 'Program Week' : 'Calendar Month';
}

function formatNotificationRoute(route: ScheduledNotificationItem['route']) {
  if (route === 'year') return 'Year';
  if (route === 'library') return 'Library';
  return 'Today';
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

const lightStyles = StyleSheet.create({
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
  warningText: {
    marginTop: 4,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
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
    minHeight: 44,
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
    minHeight: 44,
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
  lineChart: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  lineChartAxis: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    left: 10,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  lineChartSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#0F766E',
  },
  lineChartPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 4,
    backgroundColor: '#1E3A5F',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  compositionTrack: {
    flexDirection: 'row',
    height: 18,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  compositionSegment: {
    minWidth: 2,
  },
  compositionLegend: {
    gap: 4,
    marginTop: 8,
  },
  compositionLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  compositionSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  stackedTrack: {
    flexDirection: 'row',
    height: 10,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  plannedSegment: {
    backgroundColor: '#CBD5E1',
  },
  actualSegment: {
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
    minHeight: 44,
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

const darkStyleOverrides = StyleSheet.create({
  safeArea: { backgroundColor: '#07110F' },
  shell: { backgroundColor: '#07110F' },
  header: { backgroundColor: '#0D1B18', borderBottomColor: '#1F3A35' },
  appName: { color: '#F5F1DF' },
  dateText: { color: '#9CB5AD' },
  positionCard: { backgroundColor: '#0D1B18', borderColor: '#2B4A43' },
  meta: { color: '#85D6C8' },
  positionTitle: { color: '#F8FAFC' },
  eyebrow: { color: '#BCD0C8' },
  panel: { backgroundColor: '#0D1B18', borderColor: '#1F3A35' },
  sectionTitle: { color: '#E5EEE9' },
  body: { color: '#BCD0C8' },
  summaryBlock: { borderTopColor: '#1F3A35' },
  summaryTitle: { color: '#F8FAFC' },
  summaryText: { color: '#BCD0C8' },
  warningText: { color: '#F0C56A' },
  sessionPanel: { backgroundColor: '#10231F', borderColor: '#2B4A43' },
  sessionTitle: { color: '#F8FAFC' },
  baselineInput: {
    backgroundColor: '#07110F',
    borderColor: '#2B4A43',
    color: '#F8FAFC',
  },
  noteInput: {
    backgroundColor: '#07110F',
    borderColor: '#2B4A43',
    color: '#F8FAFC',
  },
  primaryButton: { backgroundColor: '#2A7C71' },
  secondaryButton: {
    backgroundColor: '#10231F',
    borderColor: '#85D6C8',
  },
  selectedButton: { backgroundColor: '#1F3A35' },
  secondaryButtonText: { color: '#D9F0EA' },
  currentSetText: { color: '#BCD0C8' },
  setRow: { borderLeftColor: '#85D6C8' },
  setExercise: { color: '#F8FAFC' },
  setPrescription: { color: '#9CB5AD' },
  metric: { backgroundColor: '#0D1B18', borderColor: '#1F3A35' },
  metricLabel: { color: '#9CB5AD' },
  metricValue: { color: '#F8FAFC' },
  tabBar: { backgroundColor: '#0D1B18', borderTopColor: '#1F3A35' },
  activeTab: { borderTopColor: '#85D6C8' },
  tabText: { color: '#9CB5AD' },
  activeTabText: { color: '#D9F0EA' },
  analyticsHeading: { color: '#D9F0EA' },
  barLabel: { color: '#F8FAFC' },
  barValue: { color: '#9CB5AD' },
  barTrack: { backgroundColor: '#1F3A35' },
  barFill: { backgroundColor: '#85D6C8' },
  lineChart: { backgroundColor: '#07110F', borderColor: '#1F3A35' },
  lineChartAxis: { backgroundColor: '#2B4A43' },
  lineChartSegment: { backgroundColor: '#85D6C8' },
  lineChartPoint: { backgroundColor: '#D8B45F', borderColor: '#07110F' },
  compositionTrack: { backgroundColor: '#1F3A35' },
  stackedTrack: { backgroundColor: '#1F3A35' },
  plannedSegment: { backgroundColor: '#2B4A43' },
  actualSegment: { backgroundColor: '#85D6C8' },
  heatmapFigure: { backgroundColor: '#0D1B18', borderColor: '#2B4A43' },
  heatmapTitle: { color: '#F8FAFC' },
  heatmapEmpty: { color: '#9CB5AD' },
});

function getStyles(theme: AppSettings['theme']) {
  if (theme !== 'scholar_dark') return lightStyles;
  return new Proxy(lightStyles, {
    get(target, key: keyof typeof lightStyles) {
      return [target[key], darkStyleOverrides[key as keyof typeof darkStyleOverrides]];
    },
  }) as typeof lightStyles;
}

let styles = getStyles(defaultSettings.theme);
