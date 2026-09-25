import {
  clampDueDay,
  computeExpenseOccurrenceDates,
  computeIncomeOccurrenceDates,
  computeMonthlyOccurrenceDates,
} from './recurring-schedule';

describe('clampDueDay', () => {
  it('returns the day unchanged when it exists in the month', () => {
    expect(clampDueDay(2026, 0, 15)).toBe(15); // January
  });

  it('clamps to Feb 28 in a non-leap year', () => {
    expect(clampDueDay(2026, 1, 31)).toBe(28);
  });

  it('clamps to Feb 29 in a leap year', () => {
    expect(clampDueDay(2028, 1, 31)).toBe(29);
  });

  it('clamps to 30 in a 30-day month', () => {
    expect(clampDueDay(2026, 3, 31)).toBe(30); // April
  });
});

describe('computeMonthlyOccurrenceDates', () => {
  it('backfills every missed month from startDate through now on first-ever generation', () => {
    const startDate = new Date(2026, 0, 15); // Jan 15, 2026
    const now = new Date(2026, 3, 20); // Apr 20, 2026
    const dates = computeMonthlyOccurrenceDates(15, startDate, null, now);

    expect(dates).toHaveLength(4);
    expect(dates.map((d) => d.getMonth())).toEqual([0, 1, 2, 3]);
    expect(dates.every((d) => d.getDate() === 15)).toBe(true);
  });

  it('only generates strictly-after months once a last-generated date exists', () => {
    const startDate = new Date(2026, 0, 15);
    const lastGeneratedDate = new Date(2026, 1, 15); // Feb 15
    const now = new Date(2026, 3, 20); // Apr 20
    const dates = computeMonthlyOccurrenceDates(15, startDate, lastGeneratedDate, now);

    expect(dates.map((d) => d.getMonth())).toEqual([2, 3]); // Mar, Apr only
  });

  it('applies month-end clamping across months with different lengths', () => {
    const startDate = new Date(2026, 0, 31); // Jan 31
    const now = new Date(2026, 3, 30); // Apr 30
    const dates = computeMonthlyOccurrenceDates(31, startDate, null, now);

    expect(dates.map((d) => d.getDate())).toEqual([31, 28, 31, 30]); // Jan, Feb, Mar, Apr
  });

  // Reverses a prior Stage 6b decision, per explicit user request (found
  // during Stage 13 review): a due day earlier in the current month than
  // the creation date used to be skipped entirely, deferring to next
  // month. It should instead generate immediately, showing as overdue —
  // symmetric with the "due later in the current month" case above.
  it("generates the current month's occurrence even when its due day is earlier than startDate", () => {
    const startDate = new Date(2026, 2, 10); // Mar 10
    const now = new Date(2026, 2, 31);
    const dates = computeMonthlyOccurrenceDates(1, startDate, null, now);

    expect(dates).toHaveLength(1);
    expect(dates[0].getMonth()).toBe(2);
    expect(dates[0].getDate()).toBe(1);
  });

  it('returns nothing when throughInclusive is before the next due occurrence', () => {
    const startDate = new Date(2026, 0, 15);
    const lastGeneratedDate = new Date(2026, 0, 15);
    const now = new Date(2026, 0, 20); // still January, already generated
    const dates = computeMonthlyOccurrenceDates(15, startDate, lastGeneratedDate, now);

    expect(dates).toHaveLength(0);
  });

  // Regression: startDate/now are frequently `new Date()` (a real moment,
  // e.g. 17:23:45), not midnight. A same-day occurrence must still count —
  // caught manually in Stage 6b browser verification when creating a
  // recurring expense produced zero instances despite valid inputs.
  it('generates a same-day occurrence even when startDate/now carry a real time-of-day', () => {
    const startDate = new Date(2026, 6, 9, 17, 23, 45, 123); // Jul 9, 2026, 17:23:45.123
    const now = new Date(2026, 6, 9, 17, 24, 1, 456); // moments later, same day
    const dates = computeMonthlyOccurrenceDates(9, startDate, null, now);

    expect(dates).toHaveLength(1);
    expect(dates[0].getFullYear()).toBe(2026);
    expect(dates[0].getMonth()).toBe(6);
    expect(dates[0].getDate()).toBe(9);
  });

  // Regression: caught in Stage 6b browser verification — a definition
  // created today with a due day later this month (e.g. due on the 20th,
  // created on the 9th) produced zero occurrences, because the old logic
  // compared the occurrence's exact date against "now" instead of against
  // the current calendar period (month).
  it("generates the current month's occurrence even when its due day is later than today", () => {
    const startDate = new Date(2026, 6, 9); // created Jul 9
    const now = new Date(2026, 6, 9); // still Jul 9
    const dates = computeMonthlyOccurrenceDates(20, startDate, null, now); // due on the 20th

    expect(dates).toHaveLength(1);
    expect(dates[0].getMonth()).toBe(6);
    expect(dates[0].getDate()).toBe(20);
  });
});

describe('computeExpenseOccurrenceDates', () => {
  it('delegates to the shared monthly algorithm using dueDay', () => {
    const startDate = new Date(2026, 0, 1);
    const now = new Date(2026, 1, 5);
    const dates = computeExpenseOccurrenceDates(1, startDate, null, now);

    expect(dates).toHaveLength(2);
    expect(dates.every((d) => d.getDate() === 1)).toBe(true);
  });
});

describe('computeIncomeOccurrenceDates', () => {
  it('uses dayOfMonth (with clamping) for monthly frequency', () => {
    const startDate = new Date(2026, 0, 31);
    const now = new Date(2026, 1, 28);
    const dates = computeIncomeOccurrenceDates(
      { frequency: 'monthly', startDate, dayOfMonth: 31, anchorDate: null },
      null,
      now,
    );

    expect(dates.map((d) => d.getDate())).toEqual([31, 28]);
  });

  it('steps weekly from anchorDate, catching up multiple missed weeks', () => {
    const startDate = new Date(2026, 0, 1);
    const anchorDate = new Date(2026, 0, 1); // Thursday
    const now = new Date(2026, 0, 22); // 3 weeks later
    const dates = computeIncomeOccurrenceDates(
      { frequency: 'weekly', startDate, dayOfMonth: null, anchorDate },
      null,
      now,
    );

    expect(dates).toHaveLength(4); // day 1, 8, 15, 22
    expect(dates.map((d) => d.getDate())).toEqual([1, 8, 15, 22]);
  });

  it('steps biweekly from anchorDate', () => {
    const startDate = new Date(2026, 0, 1);
    const anchorDate = new Date(2026, 0, 1);
    const now = new Date(2026, 0, 29);
    const dates = computeIncomeOccurrenceDates(
      { frequency: 'biweekly', startDate, dayOfMonth: null, anchorDate },
      null,
      now,
    );

    expect(dates.map((d) => d.getDate())).toEqual([1, 15, 29]);
  });

  it('resumes weekly stepping strictly after the last generated date', () => {
    const startDate = new Date(2026, 0, 1);
    const anchorDate = new Date(2026, 0, 1);
    const lastGeneratedDate = new Date(2026, 0, 8);
    const now = new Date(2026, 0, 22);
    const dates = computeIncomeOccurrenceDates(
      { frequency: 'weekly', startDate, dayOfMonth: null, anchorDate },
      lastGeneratedDate,
      now,
    );

    expect(dates.map((d) => d.getDate())).toEqual([15, 22]);
  });

  it('defaults anchorDate to startDate when not provided', () => {
    const startDate = new Date(2026, 0, 5);
    const now = new Date(2026, 0, 19);
    const dates = computeIncomeOccurrenceDates(
      { frequency: 'weekly', startDate, dayOfMonth: null, anchorDate: null },
      null,
      now,
    );

    expect(dates.map((d) => d.getDate())).toEqual([5, 12, 19]);
  });

  // Regression: same real-time-of-day issue as computeMonthlyOccurrenceDates
  // above, but for the weekly/biweekly anchor-stepping branch.
  it('generates a same-day occurrence for weekly when startDate/anchorDate carry a real time-of-day', () => {
    const startDate = new Date(2026, 6, 9, 17, 23, 45, 123);
    const anchorDate = new Date(2026, 6, 9, 17, 23, 45, 123);
    const now = new Date(2026, 6, 9, 17, 24, 1, 456);
    const dates = computeIncomeOccurrenceDates(
      { frequency: 'weekly', startDate, dayOfMonth: null, anchorDate },
      null,
      now,
    );

    expect(dates).toHaveLength(1);
    expect(dates[0].getDate()).toBe(9);
  });
});
