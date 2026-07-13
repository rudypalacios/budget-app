import { getCurrentCycleRange, isWithinCycle } from './cycle';

describe('getCurrentCycleRange', () => {
  it('returns the first instant of the month as start', () => {
    const { start } = getCurrentCycleRange(new Date(2026, 6, 15, 12, 30));
    expect(start).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
  });

  it('returns the first instant of the next month as end', () => {
    const { end } = getCurrentCycleRange(new Date(2026, 6, 15, 12, 30));
    expect(end).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
  });

  it('rolls over December to January of the following year', () => {
    const { start, end } = getCurrentCycleRange(new Date(2026, 11, 25));
    expect(start).toEqual(new Date(2026, 11, 1, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
  });

  it('handles a leap-year February correctly', () => {
    const { start, end } = getCurrentCycleRange(new Date(2028, 1, 29));
    expect(start).toEqual(new Date(2028, 1, 1, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2028, 2, 1, 0, 0, 0, 0));
  });
});

describe('isWithinCycle', () => {
  const cycleRange = getCurrentCycleRange(new Date(2026, 6, 15));

  it('includes a date exactly at start', () => {
    expect(isWithinCycle(new Date(2026, 6, 1, 0, 0, 0, 0), cycleRange)).toBe(true);
  });

  it('excludes a date exactly at end (exclusive upper bound)', () => {
    expect(isWithinCycle(new Date(2026, 7, 1, 0, 0, 0, 0), cycleRange)).toBe(false);
  });

  it('includes a date one millisecond before end', () => {
    expect(isWithinCycle(new Date(2026, 6, 31, 23, 59, 59, 999), cycleRange)).toBe(true);
  });

  it('excludes a date in the previous month', () => {
    expect(isWithinCycle(new Date(2026, 5, 30, 23, 59, 59, 999), cycleRange)).toBe(false);
  });

  it('excludes a date in the following month', () => {
    expect(isWithinCycle(new Date(2026, 7, 15), cycleRange)).toBe(false);
  });
});
