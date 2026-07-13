import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getConsistencyCalendar,
  type CalendarWorkout,
} from './domain/analytics/consistencyCalendar';
import {
  calculateMuscleExposure,
  type MuscleExposureSet,
} from './domain/analytics/muscleExposure';
import {
  getWeeklyVolume,
  type VolumeSet,
} from './domain/analytics/weeklyVolume';
import { programSeed } from './data/programSeed';
import {
  createTrainingYear,
  formatProgramPosition,
  getProgramPosition,
} from './domain/program/yearEngine';
import { getDueWorkout } from './domain/program/seedResolver';
import { createPlannedSets } from './domain/workout/sessionPlanner';

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

const sampleCompletedSets: (VolumeSet & MuscleExposureSet)[] = [
  {
    completedAt: '2026-01-01T10:00:00Z',
    exerciseId: 'back_squat',
    setType: 'working',
    completed: true,
    weight: 100,
    reps: 5,
  },
  {
    completedAt: '2026-01-01T10:08:00Z',
    exerciseId: 'back_squat',
    setType: 'working',
    completed: true,
    weight: 100,
    reps: 5,
  },
  {
    completedAt: '2026-01-03T10:00:00Z',
    exerciseId: 'barbell_bench_press',
    setType: 'working',
    completed: true,
    weight: 80,
    reps: 6,
  },
  {
    completedAt: '2026-01-08T10:00:00Z',
    exerciseId: 'deadlift',
    setType: 'working',
    completed: true,
    weight: 140,
    reps: 4,
  },
];

const sampleScheduledWorkouts: CalendarWorkout[] = [
  { scheduledDate: '2026-01-01', status: 'completed' },
  { scheduledDate: '2026-01-03', status: 'completed' },
  { scheduledDate: '2026-01-05', status: 'missed' },
  { scheduledDate: '2026-01-08', status: 'completed' },
];

const muscleNameById: Map<string, string> = new Map(
  programSeed.muscles.map((muscle) => [muscle.id, muscle.name]),
);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today');
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
            {activeTab === 'today' ? <TodayWorkoutSummary dueWorkout={dueWorkout} /> : null}
            {activeTab === 'analytics' ? <AnalyticsSummary /> : null}
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
  dueWorkout,
}: {
  dueWorkout: ReturnType<typeof getDueWorkout>;
}) {
  if (dueWorkout.status === 'workout_due') {
    const plannedSets = createPlannedSets(dueWorkout.workout);
    const previewSets = plannedSets.slice(0, 5);

    return (
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryTitle}>{dueWorkout.workout.name}</Text>
        <Text style={styles.summaryText}>
          {dueWorkout.workout.estimatedDurationMin ?? 0} min -{' '}
          {dueWorkout.workout.exercises.length} exercises - {plannedSets.length} planned sets
        </Text>
        <Text style={styles.summaryText}>
          Main lifts: {dueWorkout.mainLifts.join(', ')}
        </Text>
        <View style={styles.setPreview}>
          {previewSets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setExercise}>{set.exerciseName}</Text>
              <Text style={styles.setPrescription}>
                Set {set.setNumber} - {set.setType}
                {set.targetReps ? ` - ${set.targetReps} reps` : ''}
                {formatPercentRange(set.percent1RmLow, set.percent1RmHigh)}
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

function AnalyticsSummary() {
  const weeklyVolume = getWeeklyVolume(sampleCompletedSets);
  const consistency = getConsistencyCalendar(sampleScheduledWorkouts);
  const muscleExposure = calculateMuscleExposure(sampleCompletedSets)
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
        Uses local sample logs until persisted workout history is wired into the app.
      </Text>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Weekly Volume</Text>
        {weeklyVolume.map((point) => (
          <BarRow
            key={point.weekKey}
            label={point.weekKey}
            value={`${point.totalVolume} kg reps`}
            percent={(point.totalVolume / maxVolume) * 100}
          />
        ))}
      </View>

      <View style={styles.analyticsSection}>
        <Text style={styles.analyticsHeading}>Muscle Exposure</Text>
        {muscleExposure.map((exposure) => (
          <BarRow
            key={exposure.muscleId}
            label={muscleNameById.get(exposure.muscleId) ?? exposure.muscleId}
            value={`${exposure.hardSets.toFixed(1)} hard sets`}
            percent={(exposure.volumeLoad / maxExposure) * 100}
          />
        ))}
      </View>

      <View style={styles.analyticsFooter}>
        <Metric label="Completed" value={String(completed)} />
        <Metric label="Missed" value={String(missed)} />
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
