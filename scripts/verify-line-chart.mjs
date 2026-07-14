import assert from 'node:assert/strict';

const { getLineChartPlot } = await import('../src/domain/analytics/lineChart.ts');

assert.deepEqual(getLineChartPlot([], 100, 80), []);
assert.deepEqual(getLineChartPlot([{ label: 'A', value: 10 }], 100, 80), [
  { label: 'A', value: 10, x: 50, y: 40 },
]);

assert.deepEqual(
  getLineChartPlot(
    [
      { label: 'A', value: 100 },
      { label: 'B', value: 150 },
      { label: 'C', value: 125 },
    ],
    120,
    100,
  ),
  [
    { label: 'A', value: 100, x: 10, y: 90 },
    { label: 'B', value: 150, x: 60, y: 10 },
    { label: 'C', value: 125, x: 110, y: 50 },
  ],
);

assert.deepEqual(
  getLineChartPlot(
    [
      { label: 'A', value: 100 },
      { label: 'B', value: 100 },
    ],
    120,
    100,
  ),
  [
    { label: 'A', value: 100, x: 10, y: 50 },
    { label: 'B', value: 100, x: 110, y: 50 },
  ],
);

console.log('line chart verified');
