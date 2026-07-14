import { annualWeekTemplates, type AnnualWeekTemplate } from './annualTemplate.ts';

export type ProgramWeek = AnnualWeekTemplate & {
  startDate: string;
  endDate: string;
};

export type TrainingYear = {
  startDate: string;
  endDate: string;
  weeks: ProgramWeek[];
};

export type ProgramPosition =
  | { status: 'before_year'; nextWeek: ProgramWeek }
  | { status: 'in_year'; week: ProgramWeek; dayOfWeek: number }
  | { status: 'after_year'; lastWeek: ProgramWeek };

const daysPerWeek = 7;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function createTrainingYear(startDate: Date | string): TrainingYear {
  const start = toUtcDateOnly(startDate);
  const weeks = annualWeekTemplates.map((template) => {
    const weekStart = addDays(start, (template.yearWeekNumber - 1) * daysPerWeek);
    const weekEnd = addDays(weekStart, daysPerWeek - 1);

    return {
      ...template,
      startDate: toIsoDate(weekStart),
      endDate: toIsoDate(weekEnd),
    };
  });

  return {
    startDate: weeks[0].startDate,
    endDate: weeks[weeks.length - 1].endDate,
    weeks,
  };
}

export function getProgramWeekStart(date: Date | string = new Date()) {
  const target = toUtcDateOnly(date);
  const daysSinceMonday = (target.getUTCDay() + 6) % daysPerWeek;
  return toIsoDate(addDays(target, -daysSinceMonday));
}

export function getProgramPosition(
  date: Date | string,
  trainingYear: TrainingYear,
): ProgramPosition {
  const target = toUtcDateOnly(date);
  const start = toUtcDateOnly(trainingYear.startDate);
  const weekIndex = Math.floor(daysBetween(start, target) / daysPerWeek);

  if (weekIndex < 0) {
    return { status: 'before_year', nextWeek: trainingYear.weeks[0] };
  }

  if (weekIndex >= trainingYear.weeks.length) {
    return {
      status: 'after_year',
      lastWeek: trainingYear.weeks[trainingYear.weeks.length - 1],
    };
  }

  return {
    status: 'in_year',
    week: trainingYear.weeks[weekIndex],
    dayOfWeek: (daysBetween(start, target) % daysPerWeek) + 1,
  };
}

export function formatProgramPosition(position: ProgramPosition) {
  if (position.status === 'before_year') {
    return `Before training year - Week ${position.nextWeek.yearWeekNumber} starts next`;
  }

  if (position.status === 'after_year') {
    return `Training year complete - Week ${position.lastWeek.yearWeekNumber} was final`;
  }

  const phase = position.week.phaseWeekNumber
    ? `Phase Week ${position.week.phaseWeekNumber}`
    : 'Buffer Week';

  return `Block ${position.week.blockNumber} - ${phase} - Day ${position.dayOfWeek}`;
}

function toUtcDateOnly(date: Date | string) {
  if (typeof date === 'string') {
    const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  const value = date;
  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
