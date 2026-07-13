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
  type AnalyticsSet,
} from './db/analyticsQueries';
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
import { getAppSettings, saveAppSettings } from './db/settingsQueries';
import { saveWorkoutDraft } from './db/workoutLogPersistence';
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
} from './domain/program/yearEngine';
import { defaultSettings, type AppSettings } from './domain/settings/appSettings';
import { getSuggestedLoad } from './domain/load/suggestedLoad';
import { getDueWorkout } from './domain/program/seedResolver';
import { createPlannedSets } from './domain/workout/sessionPlanner';
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
  const [calendarWorkouts, setCalendarWorkouts] = useState<CalendarWorkout[]>([]);
  const [historyItems, setHistoryItems] = useState<WorkoutHistoryItem[]>([]);
  const [libraryExercises, setLibraryExercises] = useState<ExerciseLibraryItem[]>(
    [],
  );
  const [oneRmRecords, setOneRmRecords] = useState<CurrentOneRmRecord[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
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
    setTodayInstance(await getTodayWorkoutInstance(database));
    setAnalyticsSets(await getCompletedAnalyticsSets(database));
    setCalendarWorkouts(await getCalendarWorkouts(database));
    setHistoryItems(await getRecentWorkoutHistory(database));
    setLibraryExercises(await getExerciseLibrary(database));
    setOneRmRecords(await getCurrentOneRmRecords(database));
    setAppSettings(await getAppSettings(database));
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
              />
            ) : null}
            {activeTab === 'history' ? (
              <HistorySummary dbStatus={dbStatus} historyItems={historyItems} />
            ) : null}
            {activeTab === 'library' ? (
              <LibrarySummary
                db={db}
                appSettings={appSettings}
                dbStatus={dbStatus}
                exercises={libraryExercises}
                onSaved={refreshLocalData}
                oneRmRecords={oneRmRecords}
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
  appSettings,
  dueWorkout,
  onSaved,
  oneRmRecords,
  todayInstance,
}: {
  db: TrainingDatabase | null;
  dbReady: boolean;
  dbStatus: string;
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
    if (!restTimer) return;

    const id = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [restTimer]);

  if (dueWorkout.status === 'workout_due') {
    const plannedSets = createPlannedSets(dueWorkout.workout);
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
        unit: 'kg',
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
}: {
  calendarWorkouts: CalendarWorkout[];
  completedSets: AnalyticsSet[];
  dbStatus: string;
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
}: {
  dbStatus: string;
  historyItems: WorkoutHistoryItem[];
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
    </View>
  );
}

function LibrarySummary({
  appSettings,
  db,
  dbStatus,
  exercises,
  onSaved,
  oneRmRecords,
}: {
  appSettings: AppSettings;
  db: TrainingDatabase | null;
  dbStatus: string;
  exercises: ExerciseLibraryItem[];
  onSaved: (database: TrainingDatabase) => Promise<void>;
  oneRmRecords: CurrentOneRmRecord[];
}) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftPlateIncrement, setDraftPlateIncrement] = useState('');
  const [saveStatus, setSaveStatus] = useState('Baselines not changed');
  const recordByExercise = new Map(
    oneRmRecords.map((record) => [record.exerciseId, record]),
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
