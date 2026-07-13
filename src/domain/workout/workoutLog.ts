import type { PlannedSet } from './sessionPlanner';

export type ActualSet = {
  plannedSetId: string;
  completed: boolean;
  skipped: boolean;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
};

export type WorkoutDraft = {
  workoutId: string;
  startedAt: string;
  status: 'draft' | 'completed';
  plannedSets: readonly PlannedSet[];
  actualSets: readonly ActualSet[];
};

export const skippedSetNote = 'Skipped set';

export function createWorkoutDraft(
  workoutId: string,
  plannedSets: readonly PlannedSet[],
  startedAt = new Date().toISOString(),
): WorkoutDraft {
  return {
    workoutId,
    startedAt,
    status: 'draft',
    plannedSets,
    actualSets: plannedSets.map((set) => ({
      plannedSetId: set.id,
      completed: false,
      skipped: false,
      weight: null,
      reps: null,
      rpe: null,
      notes: null,
    })),
  };
}

export function completeSet(
  draft: WorkoutDraft,
  plannedSetId: string,
  result: { weight: number; reps: number; rpe?: number | null; notes?: string | null },
): WorkoutDraft {
  assertNonNegative(result.weight, 'weight');
  assertPositiveInteger(result.reps, 'reps');

  if (result.rpe !== undefined && result.rpe !== null) {
    assertRpe(result.rpe);
  }

  let matched = false;
  const actualSets = draft.actualSets.map((set) => {
    if (set.plannedSetId !== plannedSetId) return set;
    matched = true;

    return {
      plannedSetId,
      completed: true,
      skipped: false,
      weight: result.weight,
      reps: result.reps,
      rpe: result.rpe ?? null,
      notes: result.notes ?? null,
    };
  });

  if (!matched) {
    throw new Error(`Unknown planned set: ${plannedSetId}`);
  }

  return { ...draft, status: 'draft', actualSets };
}

export function skipSet(
  draft: WorkoutDraft,
  plannedSetId: string,
  notes = skippedSetNote,
): WorkoutDraft {
  let matched = false;
  const actualSets = draft.actualSets.map((set) => {
    if (set.plannedSetId !== plannedSetId) return set;
    matched = true;

    return {
      plannedSetId,
      completed: false,
      skipped: true,
      weight: null,
      reps: null,
      rpe: null,
      notes,
    };
  });

  if (!matched) {
    throw new Error(`Unknown planned set: ${plannedSetId}`);
  }

  return { ...draft, status: 'draft', actualSets };
}

export function addSetAfter(draft: WorkoutDraft, plannedSetId: string): WorkoutDraft {
  const index = draft.plannedSets.findIndex((set) => set.id === plannedSetId);
  if (index === -1) {
    throw new Error(`Unknown planned set: ${plannedSetId}`);
  }

  const source = draft.plannedSets[index];
  const exerciseSets = draft.plannedSets.filter(
    (set) => set.exerciseOrder === source.exerciseOrder,
  );
  const addedSet = {
    ...source,
    id: `${source.id}_added_${exerciseSets.length + 1}`,
    setNumber: Math.max(...exerciseSets.map((set) => set.setNumber)) + 1,
    setType: 'added',
  };
  const addedActualSet = {
    plannedSetId: addedSet.id,
    completed: false,
    skipped: false,
    weight: null,
    reps: null,
    rpe: null,
    notes: null,
  };

  return {
    ...draft,
    status: 'draft',
    plannedSets: [
      ...draft.plannedSets.slice(0, index + 1),
      addedSet,
      ...draft.plannedSets.slice(index + 1),
    ],
    actualSets: [
      ...draft.actualSets.slice(0, index + 1),
      addedActualSet,
      ...draft.actualSets.slice(index + 1),
    ],
  };
}

export function removeSet(draft: WorkoutDraft, plannedSetId: string): WorkoutDraft {
  const actual = draft.actualSets.find((set) => set.plannedSetId === plannedSetId);
  if (!actual) {
    throw new Error(`Unknown planned set: ${plannedSetId}`);
  }
  if (draft.actualSets.length <= 1) {
    throw new Error('Cannot remove the final set');
  }
  if (actual.completed || actual.skipped) {
    throw new Error('Cannot remove a completed or skipped set');
  }

  return {
    ...draft,
    status: 'draft',
    plannedSets: draft.plannedSets.filter((set) => set.id !== plannedSetId),
    actualSets: draft.actualSets.filter((set) => set.plannedSetId !== plannedSetId),
  };
}

export function summarizeWorkoutDraft(draft: WorkoutDraft) {
  const completedSets = draft.actualSets.filter((set) => set.completed);
  const totalVolume = completedSets.reduce(
    (total, set) => total + (set.weight ?? 0) * (set.reps ?? 0),
    0,
  );
  const rpeSets = completedSets.filter((set) => set.rpe !== null);
  const averageRpe =
    rpeSets.length === 0
      ? null
      : rpeSets.reduce((total, set) => total + (set.rpe ?? 0), 0) / rpeSets.length;

  return {
    plannedSets: draft.plannedSets.length,
    completedSets: completedSets.length,
    totalVolume,
    averageRpe,
    isComplete: draft.actualSets.every((set) => set.completed || set.skipped),
  };
}

export function completeWorkout(draft: WorkoutDraft): WorkoutDraft {
  const summary = summarizeWorkoutDraft(draft);
  if (summary.plannedSets === 0) {
    throw new Error('Cannot complete workout with no sets');
  }
  if (!summary.isComplete) {
    throw new Error('Cannot complete workout with unfinished sets');
  }

  return { ...draft, status: 'completed' };
}

function assertNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertRpe(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error('rpe must be between 0 and 10');
  }
}
