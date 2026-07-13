import assert from 'node:assert/strict';

const {
  createTrainingYear,
  formatProgramPosition,
  getProgramPosition,
} = await import('../src/domain/program/yearEngine.ts');

const year = createTrainingYear('2026-01-01');

assert.equal(year.weeks.length, 52);
assert.equal(year.startDate, '2026-01-01');
assert.equal(year.endDate, '2026-12-30');

const firstDay = getProgramPosition('2026-01-01', year);
assert.equal(firstDay.status, 'in_year');
assert.equal(firstDay.week.yearWeekNumber, 1);
assert.equal(firstDay.dayOfWeek, 1);

const taperWeek = getProgramPosition('2026-08-27', year);
assert.equal(taperWeek.status, 'in_year');
assert.equal(taperWeek.week.yearWeekNumber, 35);
assert.equal(taperWeek.week.weekType, 'taper');

const finalBuffer = getProgramPosition('2026-12-30', year);
assert.equal(finalBuffer.status, 'in_year');
assert.equal(finalBuffer.week.yearWeekNumber, 52);
assert.equal(finalBuffer.week.isBuffer, true);

assert.equal(
  formatProgramPosition(firstDay),
  'Block 1 - Phase Week 1 - Day 1',
);

console.log('year engine verified: 52-week resolver');
