export type CycleRange = {
  start: Date;
  end: Date;
};

// Calendar-month cycle, half-open interval: `start` is the first instant of
// the month, `end` is the first instant of the *next* month (exclusive) —
// membership is `date >= start && date < end`. Centralized here (rather than
// inlined month-math at each call site) so a future configurable cycle
// length (e.g. weekly/quincena, backlogged) only needs one function's
// implementation to change — see data-model.md §12.
export function getCurrentCycleRange(referenceDate: Date = new Date()): CycleRange {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  return { start, end };
}

export function isWithinCycle(date: Date, cycleRange: CycleRange): boolean {
  return date >= cycleRange.start && date < cycleRange.end;
}
