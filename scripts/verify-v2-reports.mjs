import assert from 'node:assert/strict';

const {
  comparePlannedActualMuscleExposure,
  getBlockReport,
  getFatigueReasons,
} = await import('../src/domain/analytics/v2Reports.ts');

assert.deepEqual(
  comparePlannedActualMuscleExposure(
    [
      { muscleId: 'quads', hardSets: 10, volumeLoad: 1000 },
      { muscleId: 'chest', hardSets: 4, volumeLoad: 400 },
    ],
    [
      { muscleId: 'quads', hardSets: 7, volumeLoad: 700 },
      { muscleId: 'lats', hardSets: 3, volumeLoad: 300 },
    ],
  ),
  [
    { muscleId: 'chest', plannedHardSets: 4, actualHardSets: 0, hardSetDelta: -4 },
    { muscleId: 'quads', plannedHardSets: 10, actualHardSets: 7, hardSetDelta: -3 },
    { muscleId: 'lats', plannedHardSets: 0, actualHardSets: 3, hardSetDelta: 3 },
  ],
);

const report = getBlockReport([
  { blockNumber: 1, phaseCode: 'phase1', totalVolume: 1000, workingSets: 10 },
  { blockNumber: 2, phaseCode: 'phase2', totalVolume: 2000, workingSets: 8 },
]);
assert.equal(report.topVolume?.blockNumber, 2);
assert.equal(report.topSets?.blockNumber, 1);
assert.equal(report.averageVolume, 1500);

assert.deepEqual(
  getFatigueReasons({
    riskLevel: 'high',
    workingSets: 12,
    failedSets: 1,
    highRpeSets: 2,
    lowRirSets: 3,
    missedSessions: 0,
    performanceDropSignals: 1,
    latestWeekVolume: 900,
    priorWeekVolume: 1200,
  }),
  ['1 failed sets', '2 high-RPE sets', '3 low-RIR sets', 'week-to-week volume drop'],
);

console.log('v2 reports verified');
