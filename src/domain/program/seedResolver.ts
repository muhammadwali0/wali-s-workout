import { programSeed } from '../../data/programSeed.ts';

import type { ProgramPosition } from './yearEngine';

type PhaseCode = 'phase1' | 'phase2' | 'phase3';

export type SeedWorkout = {
  id: string;
  dayNumber: number;
  scheduledWeekday: number | null;
  name: string;
  workoutType: string;
  estimatedDurationMin: number | null;
  exercises: readonly {
    id: string;
    exerciseId: string;
    name: string;
    sortOrder: number;
    role: string;
    prescriptions: readonly {
      id: string;
      setOrder: number;
      setType: string;
      targetSets: number;
      targetRepsMin: number | null;
      targetRepsMax: number | null;
      targetRepsText: string | null;
      percent1RmLow: number | null;
      percent1RmHigh: number | null;
      targetRpeLow: number | null;
      targetRpeHigh: number | null;
      restSecondsMin: number | null;
      restSecondsMax: number | null;
      tempo: string | null;
    }[];
  }[];
};

export type DueWorkout =
  | { status: 'workout_due'; workout: SeedWorkout; mainLifts: string[] }
  | { status: 'rest_day'; nextWorkout: SeedWorkout | null }
  | { status: 'buffer_week' }
  | { status: 'outside_year' };

export function getDueWorkout(position: ProgramPosition): DueWorkout {
  if (position.status !== 'in_year') {
    return { status: 'outside_year' };
  }

  const { week } = position;
  if (week.isBuffer || !week.phaseCode || !week.phaseWeekNumber) {
    return { status: 'buffer_week' };
  }

  const phaseWeeks = programSeed.phaseWeeks[week.phaseCode as PhaseCode];
  const phaseWeek = phaseWeeks.find(
    (candidate) => candidate.weekNumber === week.phaseWeekNumber,
  );

  if (!phaseWeek) {
    return { status: 'buffer_week' };
  }

  const workout = phaseWeek.workouts.find(
    (candidate) => candidate.scheduledWeekday === position.dayOfWeek,
  );

  if (!workout) {
    return {
      status: 'rest_day',
      nextWorkout:
        phaseWeek.workouts.find(
          (candidate) => (candidate.scheduledWeekday ?? 0) > position.dayOfWeek,
        ) ?? null,
    };
  }

  return {
    status: 'workout_due',
    workout,
    mainLifts: workout.exercises
      .filter((exercise) => exercise.role === 'primary')
      .slice(0, 4)
      .map((exercise) => exercise.name),
  };
}
