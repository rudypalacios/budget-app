import type { RecurringIncome } from '@/types/firestore';

// Pure date math for recurring-instance generation (docs/data-model.md §9) —
// deliberately has zero Firestore imports so it stays unit-testable without
// pulling in the platform-split Firestore client (see
// recurring-generation.ts, which does the actual I/O using these helpers).

// Clamps a target day-of-month to the last valid day of that month — e.g.
// dueDay/dayOfMonth 31 in February becomes 28 (or 29 in a leap year).
export function clampDueDay(year: number, month: number, dueDay: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(dueDay, lastDayOfMonth);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Occurrence dates only ever carry calendar-day meaning ("which day is the
// due date"), never a specific time — but startDate/throughInclusive are
// often `new Date()` (e.g. the exact moment a definition is created), which
// carries a real time-of-day. Comparing a midnight-normalized occurrence
// against a full-precision "now" would make every same-day occurrence look
// like it's "before" now and get silently skipped. Normalizing every operand
// to midnight before comparing avoids that.
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Shared monthly-cadence algorithm for both RecurringExpense.dueDay and
// RecurringIncome.dayOfMonth: catches up every missed month between
// (lastGeneratedDate, exclusive) or startDate and throughInclusive.
//
// The upper bound is compared by *calendar month*, not exact date — per
// data-model.md §9 ("...forward through the current period"), a bill due
// later in the current month (e.g. due on the 20th, created on the 9th) is
// still part of the current period and should generate immediately, not
// wait until its specific due-day arrives.
export function computeMonthlyOccurrenceDates(
  dayOfMonth: number,
  startDate: Date,
  lastGeneratedDate: Date | null,
  throughInclusive: Date,
): Date[] {
  const normalizedStartDate = startOfDay(startDate);
  const dates: Date[] = [];
  let year: number;
  let month: number; // 0-indexed

  if (lastGeneratedDate) {
    const normalizedLastGeneratedDate = startOfDay(lastGeneratedDate);
    year = normalizedLastGeneratedDate.getFullYear();
    month = normalizedLastGeneratedDate.getMonth() + 1;
  } else {
    year = normalizedStartDate.getFullYear();
    month = normalizedStartDate.getMonth();
  }

  const throughYear = throughInclusive.getFullYear();
  const throughMonth = throughInclusive.getMonth();

  for (;;) {
    if (month > 11) {
      month -= 12;
      year += 1;
    }
    if (year > throughYear || (year === throughYear && month > throughMonth)) break;
    const day = clampDueDay(year, month, dayOfMonth);
    const occurrence = new Date(year, month, day);
    if (occurrence >= normalizedStartDate) dates.push(occurrence);
    month += 1;
  }

  return dates;
}

// RecurringExpense has no `frequency` field — expenses are always monthly.
export function computeExpenseOccurrenceDates(
  dueDay: number,
  startDate: Date,
  lastGeneratedDate: Date | null,
  throughInclusive: Date,
): Date[] {
  return computeMonthlyOccurrenceDates(dueDay, startDate, lastGeneratedDate, throughInclusive);
}

export function computeIncomeOccurrenceDates(
  definition: {
    frequency: RecurringIncome['frequency'];
    startDate: Date;
    dayOfMonth: number | null;
    anchorDate: Date | null;
  },
  lastGeneratedDate: Date | null,
  throughInclusive: Date,
): Date[] {
  if (definition.frequency === 'monthly') {
    const dayOfMonth = definition.dayOfMonth ?? definition.startDate.getDate();
    return computeMonthlyOccurrenceDates(dayOfMonth, definition.startDate, lastGeneratedDate, throughInclusive);
  }

  const stepDays = definition.frequency === 'weekly' ? 7 : 14;
  const anchor = startOfDay(definition.anchorDate ?? definition.startDate);
  const normalizedStartDate = startOfDay(definition.startDate);
  const normalizedThroughInclusive = startOfDay(throughInclusive);
  const dates: Date[] = [];
  let candidate = lastGeneratedDate ? addDays(startOfDay(lastGeneratedDate), stepDays) : anchor;

  while (candidate <= normalizedThroughInclusive) {
    if (candidate >= normalizedStartDate) dates.push(candidate);
    candidate = addDays(candidate, stepDays);
  }

  return dates;
}

export function formatYearMonth(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function formatYearMonthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
