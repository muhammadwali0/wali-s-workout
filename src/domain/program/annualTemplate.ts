export type WeekType =
  | 'normal'
  | 'semi_deload'
  | 'deload'
  | 'taper'
  | 'test'
  | 'buffer';

export type AnnualWeekTemplate = {
  yearWeekNumber: number;
  blockNumber: number;
  phaseCode: 'phase1' | 'phase2' | 'phase3' | null;
  phaseWeekNumber: number | null;
  weekType: WeekType;
  isBuffer: boolean;
};

const weekRows = [
  [1, 1, 'phase1', 1, 'normal', false],
  [2, 1, 'phase1', 2, 'normal', false],
  [3, 1, 'phase1', 3, 'normal', false],
  [4, 1, 'phase1', 4, 'normal', false],
  [5, 1, 'phase1', 5, 'normal', false],
  [6, 1, 'phase1', 6, 'semi_deload', false],
  [7, 1, 'phase1', 7, 'normal', false],
  [8, 1, 'phase1', 8, 'normal', false],
  [9, 1, 'phase1', 9, 'normal', false],
  [10, 1, 'phase1', 10, 'test', false],
  [11, 1, 'phase1', 11, 'deload', false],
  [12, 1, null, null, 'buffer', true],
  [13, 1, null, null, 'buffer', true],
  [14, 2, 'phase2', 1, 'normal', false],
  [15, 2, 'phase2', 2, 'normal', false],
  [16, 2, 'phase2', 3, 'normal', false],
  [17, 2, 'phase2', 4, 'normal', false],
  [18, 2, 'phase2', 5, 'normal', false],
  [19, 2, 'phase2', 6, 'normal', false],
  [20, 2, 'phase2', 7, 'normal', false],
  [21, 2, 'phase2', 8, 'semi_deload', false],
  [22, 2, 'phase2', 9, 'normal', false],
  [23, 2, 'phase2', 10, 'normal', false],
  [24, 2, 'phase2', 11, 'normal', false],
  [25, 2, 'phase2', 12, 'normal', false],
  [26, 2, null, null, 'buffer', true],
  [27, 3, 'phase3', 1, 'normal', false],
  [28, 3, 'phase3', 2, 'normal', false],
  [29, 3, 'phase3', 3, 'normal', false],
  [30, 3, 'phase3', 4, 'normal', false],
  [31, 3, 'phase3', 5, 'semi_deload', false],
  [32, 3, 'phase3', 6, 'normal', false],
  [33, 3, 'phase3', 7, 'normal', false],
  [34, 3, 'phase3', 8, 'normal', false],
  [35, 3, 'phase3', 9, 'taper', false],
  [36, 3, 'phase3', 10, 'test', false],
  [37, 3, null, null, 'buffer', true],
  [38, 3, null, null, 'buffer', true],
  [39, 3, null, null, 'buffer', true],
  [40, 4, 'phase2', 1, 'normal', false],
  [41, 4, 'phase2', 2, 'normal', false],
  [42, 4, 'phase2', 3, 'normal', false],
  [43, 4, 'phase2', 4, 'normal', false],
  [44, 4, 'phase2', 5, 'normal', false],
  [45, 4, 'phase2', 6, 'normal', false],
  [46, 4, 'phase2', 7, 'normal', false],
  [47, 4, 'phase2', 8, 'semi_deload', false],
  [48, 4, 'phase2', 9, 'normal', false],
  [49, 4, 'phase2', 10, 'normal', false],
  [50, 4, 'phase2', 11, 'normal', false],
  [51, 4, 'phase2', 12, 'normal', false],
  [52, 4, null, null, 'buffer', true],
] as const;

export const annualWeekTemplates: AnnualWeekTemplate[] = weekRows.map(
  ([yearWeekNumber, blockNumber, phaseCode, phaseWeekNumber, weekType, isBuffer]) => ({
    yearWeekNumber,
    blockNumber,
    phaseCode,
    phaseWeekNumber,
    weekType,
    isBuffer,
  }),
);
