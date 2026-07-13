export type FilterableAnalyticsSet = {
  completedAt: string;
  blockNumber: number | null;
  phaseCode: string | null;
};

export type AnalyticsSetFilter =
  | { mode: 'all' }
  | { mode: 'date_range'; fromDate: string; toDate: string }
  | { mode: 'block'; blockNumber: number }
  | { mode: 'phase'; phaseCode: string };

export function filterAnalyticsSets<T extends FilterableAnalyticsSet>(
  sets: readonly T[],
  filter: AnalyticsSetFilter,
): T[] {
  if (filter.mode === 'all') return [...sets];

  if (filter.mode === 'block') {
    return sets.filter((set) => set.blockNumber === filter.blockNumber);
  }

  if (filter.mode === 'phase') {
    return sets.filter((set) => set.phaseCode === filter.phaseCode);
  }

  return sets.filter((set) => {
    const date = set.completedAt.slice(0, 10);
    return date >= filter.fromDate && date <= filter.toDate;
  });
}
