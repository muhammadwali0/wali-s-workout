import assert from 'node:assert/strict';

const { filterAnalyticsSets } = await import('../src/domain/analytics/setFilters.ts');

const sets = [
  { completedAt: '2026-01-01T10:00:00Z', blockNumber: 1, phaseCode: 'phase1' },
  { completedAt: '2026-01-08T10:00:00Z', blockNumber: 1, phaseCode: 'phase1' },
  { completedAt: '2026-04-01T10:00:00Z', blockNumber: 2, phaseCode: 'phase2' },
];

assert.equal(filterAnalyticsSets(sets, { mode: 'all' }).length, 3);
assert.deepEqual(filterAnalyticsSets(sets, { mode: 'block', blockNumber: 2 }), [
  sets[2],
]);
assert.equal(
  filterAnalyticsSets(sets, { mode: 'phase', phaseCode: 'phase1' }).length,
  2,
);
assert.deepEqual(
  filterAnalyticsSets(sets, {
    mode: 'date_range',
    fromDate: '2026-01-02',
    toDate: '2026-01-31',
  }),
  [sets[1]],
);

console.log('analytics filters verified');
