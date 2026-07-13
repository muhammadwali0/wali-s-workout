import assert from 'node:assert/strict';

const { calculateMuscleHeatmap } = await import(
  '../src/domain/analytics/muscleHeatmap.ts'
);

const heatmap = calculateMuscleHeatmap([
  { muscleId: 'quads', hardSets: 4, volumeLoad: 1000 },
  { muscleId: 'glutes', hardSets: 2, volumeLoad: 500 },
  { muscleId: 'upper_back', hardSets: 1, volumeLoad: 250 },
  { muscleId: 'abductors', hardSets: 1, volumeLoad: 125 },
]);

assert.deepEqual(
  heatmap.filter((region) => region.muscleId === 'quads'),
  [
    {
      muscleId: 'quads',
      name: 'Quads',
      view: 'front',
      hardSets: 4,
      volumeLoad: 1000,
      intensity: 1,
    },
  ],
);
assert.equal(heatmap.find((region) => region.muscleId === 'glutes')?.view, 'back');
assert.equal(heatmap.find((region) => region.muscleId === 'upper_back')?.view, 'back');
assert.deepEqual(
  heatmap
    .filter((region) => region.muscleId === 'abductors')
    .map((region) => region.view),
  ['front', 'back'],
);
assert.equal(
  calculateMuscleHeatmap([{ muscleId: 'missing', hardSets: 1, volumeLoad: 1 }])
    .length,
  0,
);

console.log('muscle heatmap verified');
