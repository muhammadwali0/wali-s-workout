export type WorkoutStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'missed'
  | 'rescheduled';

export type WorkoutAdherenceInput = {
  status: WorkoutStatus;
};

export type AdherenceStats = {
  dueSessions: number;
  completed: number;
  missed: number;
  skipped: number;
  rescheduled: number;
  inProgress: number;
  completionRate: number;
};

export function calculateAdherence(
  workouts: WorkoutAdherenceInput[],
): AdherenceStats {
  const completed = countStatus(workouts, 'completed');
  const missed = countStatus(workouts, 'missed');
  const skipped = countStatus(workouts, 'skipped');
  const rescheduled = countStatus(workouts, 'rescheduled');
  const inProgress = countStatus(workouts, 'in_progress');
  const dueSessions = completed + missed + skipped + rescheduled + inProgress;

  return {
    dueSessions,
    completed,
    missed,
    skipped,
    rescheduled,
    inProgress,
    completionRate: dueSessions === 0 ? 0 : completed / dueSessions,
  };
}

function countStatus(workouts: WorkoutAdherenceInput[], status: WorkoutStatus) {
  return workouts.filter((workout) => workout.status === status).length;
}
