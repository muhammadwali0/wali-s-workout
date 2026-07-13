import assert from 'node:assert/strict';

const { calculateMuscleExposure } = await import(
  '../src/domain/analytics/muscleExposure.ts'
);

const exposure = calculateMuscleExposure([
  {
    exerciseId: 'back_squat',
    setType: 'working',
    completed: true,
    weight: 100,
    reps: 5,
  },
  {
    exerciseId: 'back_squat',
    setType: 'warmup',
    completed: true,
    weight: 60,
    reps: 5,
  },
  {
    exerciseId: 'barbell_bench_press',
    setType: 'working',
    completed: false,
    weight: 80,
    reps: 5,
  },
]);

assert.deepEqual(
  exposure.filter((item) => ['quads', 'glutes', 'hamstrings'].includes(item.muscleId)),
  [
    { muscleId: 'glutes', hardSets: 1, volumeLoad: 500 },
    { muscleId: 'hamstrings', hardSets: 0.5, volumeLoad: 250 },
    { muscleId: 'quads', hardSets: 1, volumeLoad: 500 },
  ],
);
assert.equal(exposure.find((item) => item.muscleId === 'chest'), undefined);

console.log('muscle exposure verified');
