import type { PlannedSet } from './sessionPlanner';

export type ActualSet = {
  plannedSetId: string;
  completed: boolean;
  skipped: boolean;
  failed: boolean;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
};

export type WorkoutDraft = {
  workoutId: string;
  startedAt: string;
  status: 'draft' | 'completed' | 'discarded';
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
      failed: false,
      weight: null,
      reps: null,
      rpe: null,
      rir: null,
      notes: null,
    })),
  };
}

export function completeSet(
  draft: WorkoutDraft,
  plannedSetId: string,
  result: {
    weight: number;
    reps: number;
    rpe?: number | null;
    rir?: number | null;
    failed?: boolean;
    notes?: string | null;
  },
): WorkoutDraft {
  assertNonNegative(result.weight, 'weight');
  assertPositiveInteger(result.reps, 'reps');

  if (result.rpe !== undefined && result.rpe !== null) {
    assertRpe(result.rpe);
  }
  if (result.rir !== undefined && result.rir !== null) {
    assertNonNegative(result.rir, 'rir');
  }

  let matched = false;
  const actualSets = draft.actualSets.map((set) => {
    if (set.plannedSetId !== plannedSetId) return set;
    matched = true;

    return {
      plannedSetId,
      completed: true,
      skipped: false,
      failed: result.failed ?? false,
      weight: result.weight,
      reps: result.reps,
      rpe: result.rpe ?? null,
      rir: result.rir ?? null,
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
      failed: false,
      weight: null,
      reps: null,
      rpe: null,
      rir: null,
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
    failed: false,
    weight: null,
    reps: null,
    rpe: null,
    rir: null,
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

export function addExercise(
  draft: WorkoutDraft,
  exercise: {
    exerciseId: string;
    name: string;
    defaultRole?: string | null;
  },
): WorkoutDraft {
  const exerciseOrder =
    Math.max(...draft.plannedSets.map((set) => set.exerciseOrder), 0) + 1;
  const addedCount = draft.plannedSets.filter(
    (set) => set.originalExerciseId === exercise.exerciseId,
  ).length;
  const addedSet: PlannedSet = {
    id: `added_${exercise.exerciseId}_${addedCount + 1}`,
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    exerciseRole: exercise.defaultRole ?? 'tertiary',
    originalExerciseId: exercise.exerciseId,
    originalExerciseName: exercise.name,
    substitutionScope: null,
    exerciseOrder,
    supersetGroup: null,
    setNumber: 1,
    setType: 'added',
    targetReps: null,
    percent1RmLow: null,
    percent1RmHigh: null,
    targetRpeLow: null,
    targetRpeHigh: null,
    restSecondsMin: null,
    restSecondsMax: null,
    tempo: null,
    notes: 'User-added exercise',
  };
  const addedActualSet = {
    plannedSetId: addedSet.id,
    completed: false,
    skipped: false,
    failed: false,
    weight: null,
    reps: null,
    rpe: null,
    rir: null,
    notes: null,
  };

  return {
    ...draft,
    status: 'draft',
    plannedSets: [...draft.plannedSets, addedSet],
    actualSets: [...draft.actualSets, addedActualSet],
  };
}

export function updatePlannedSet(
  draft: WorkoutDraft,
  plannedSetId: string,
  changes: {
    targetReps?: string | null;
    percent1Rm?: number | null;
    targetRpe?: number | null;
    restSeconds?: number | null;
  },
): WorkoutDraft {
  const actual = draft.actualSets.find((set) => set.plannedSetId === plannedSetId);
  if (!actual) {
    throw new Error(`Unknown planned set: ${plannedSetId}`);
  }
  if (actual.completed || actual.skipped) {
    throw new Error('Cannot edit a completed or skipped set');
  }
  if (changes.percent1Rm !== undefined && changes.percent1Rm !== null) {
    assertPercent(changes.percent1Rm);
  }
  if (changes.targetRpe !== undefined && changes.targetRpe !== null) {
    assertRpe(changes.targetRpe);
  }
  if (changes.restSeconds !== undefined && changes.restSeconds !== null) {
    assertPositiveInteger(changes.restSeconds, 'rest seconds');
  }

  return {
    ...draft,
    status: 'draft',
    plannedSets: draft.plannedSets.map((set) => {
      if (set.id !== plannedSetId) return set;

      return {
        ...set,
        targetReps:
          changes.targetReps === undefined ? set.targetReps : changes.targetReps,
        percent1RmLow:
          changes.percent1Rm === undefined ? set.percent1RmLow : changes.percent1Rm,
        percent1RmHigh:
          changes.percent1Rm === undefined ? set.percent1RmHigh : changes.percent1Rm,
        targetRpeLow:
          changes.targetRpe === undefined ? set.targetRpeLow : changes.targetRpe,
        targetRpeHigh:
          changes.targetRpe === undefined ? set.targetRpeHigh : changes.targetRpe,
        restSecondsMin:
          changes.restSeconds === undefined ? set.restSecondsMin : changes.restSeconds,
        restSecondsMax:
          changes.restSeconds === undefined ? set.restSecondsMax : changes.restSeconds,
        notes: appendModificationNote(set.notes),
      };
    }),
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

export function removeExercise(draft: WorkoutDraft, plannedSetId: string): WorkoutDraft {
  const planned = draft.plannedSets.find((set) => set.id === plannedSetId);
  if (!planned) {
    throw new Error(`Unknown planned set: ${plannedSetId}`);
  }

  const exerciseSetIds = new Set(
    draft.plannedSets
      .filter((set) => set.exerciseOrder === planned.exerciseOrder)
      .map((set) => set.id),
  );
  if (exerciseSetIds.size === draft.plannedSets.length) {
    throw new Error('Cannot remove the final exercise');
  }
  if (
    draft.actualSets.some(
      (set) => exerciseSetIds.has(set.plannedSetId) && (set.completed || set.skipped),
    )
  ) {
    throw new Error('Cannot remove an exercise with completed or skipped sets');
  }

  return {
    ...draft,
    status: 'draft',
    plannedSets: draft.plannedSets.filter((set) => !exerciseSetIds.has(set.id)),
    actualSets: draft.actualSets.filter((set) => !exerciseSetIds.has(set.plannedSetId)),
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

export function discardWorkout(draft: WorkoutDraft): WorkoutDraft {
  return { ...draft, status: 'discarded' };
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

function assertPercent(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('percent 1RM must be between 0 and 100');
  }
}

function appendModificationNote(notes: string | null) {
  if (notes?.includes('Personalized today')) return notes;
  return notes ? `${notes} Personalized today.` : 'Personalized today.';
}
