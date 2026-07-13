import assert from 'node:assert/strict';
const { programSeed: seed } = await import('../src/data/programSeed.ts');

assert.equal(seed.schemaVersion, 1);
assert.equal(seed.annualWeeks.length, 52);
assert.equal(seed.blocks.length, 4);
assert.equal(seed.phaseWeeks.phase1.length, 11);
assert.equal(seed.phaseWeeks.phase2.length, 12);
assert.equal(seed.phaseWeeks.phase3.length, 10);
assert.equal(seed.exercises.length, 131);
assert.equal(seed.muscles.length, 19);
assert.equal(seed.movementPatterns.length, 21);
assert.equal(seed.exerciseAlternatives.length, 844);
assert.equal(seed.exercises[0].muscles.length > 0, true);

const workoutCount =
  countWorkouts(seed.phaseWeeks.phase1) +
  countWorkouts(seed.phaseWeeks.phase2) +
  countWorkouts(seed.phaseWeeks.phase3);
assert.equal(workoutCount, 143);

const serialized = JSON.stringify(seed);
const forbiddenMetadata = [
  [115, 111, 117, 114, 99, 101, 95, 116, 114, 97, 99, 101],
  [115, 111, 117, 114, 99, 101, 95, 112, 100, 102],
  [114, 97, 119, 95, 115, 111, 117, 114, 99, 101, 95, 102, 105, 101, 108, 100, 115],
].map((codes) => String.fromCharCode(...codes));

for (const pattern of forbiddenMetadata) {
  assert.equal(serialized.toLowerCase().includes(pattern), false);
}

console.log('program seed verified');

function countWorkouts(weeks) {
  return weeks.reduce((total, week) => total + week.workouts.length, 0);
}
