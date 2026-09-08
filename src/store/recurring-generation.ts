import { getLastExpenseInstanceDate, setExpenseInstanceAt } from './expenses';
import { getLastIncomeInstanceDate, setIncomeInstanceAt } from './incomes';
import { useRecurringExpensesStore } from './recurring-expenses';
import { useRecurringIncomesStore } from './recurring-incomes';
import {
  computeExpenseOccurrenceDates,
  computeIncomeOccurrenceDates,
  formatYearMonth,
  formatYearMonthDay,
} from './recurring-schedule';
import type { CurrencyCode, RecurringIncomeFrequency } from '@/types/firestore';

// Instance generation per docs/data-model.md §9 — runs client-side (no Cloud
// Functions on the Spark plan), triggered once on app launch
// (see src/app/_layout.tsx) and once immediately after creating a new
// definition (see expenses/new.tsx, income/new.tsx) so a just-added
// recurring bill/income doesn't wait for the next launch to appear.
// Pure date math lives in recurring-schedule.ts (unit-tested there, kept
// free of Firestore imports); this file is the I/O orchestration on top.

// Deliberately narrower than the full RecurringExpense doc shape — only
// what generation actually needs. Letting the "create a new definition"
// screens pass these plain values directly (rather than reading the just-
// created doc back from the store) avoids a race: the store's listener may
// not have the new document yet by the time generation runs immediately
// after addRecurringExpense() resolves.
export type ExpenseDefinitionForGeneration = {
  id: string;
  categoryId: string;
  name: string;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  amount: number;
  dueDay: number;
  startDate: Date;
};

export type IncomeDefinitionForGeneration = {
  id: string;
  categoryId: string;
  name: string;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  amount: number;
  frequency: RecurringIncomeFrequency;
  dayOfMonth: number | null;
  anchorDate: Date | null;
  startDate: Date;
};

export async function generateExpenseInstancesForDefinition(
  uid: string,
  definition: ExpenseDefinitionForGeneration,
  now: Date,
): Promise<void> {
  const lastGeneratedDate = await getLastExpenseInstanceDate(uid, definition.id);
  const occurrenceDates = computeExpenseOccurrenceDates(
    definition.dueDay,
    definition.startDate,
    lastGeneratedDate,
    now,
  );

  for (const date of occurrenceDates) {
    const id = `${definition.id}_${formatYearMonth(date)}`;
    await setExpenseInstanceAt(id, {
      recurringExpenseId: definition.id,
      categoryId: definition.categoryId,
      name: definition.name,
      date,
      currency: definition.currency,
      exchangeRateToDefault: definition.exchangeRateToDefault,
      budgetedAmount: definition.amount,
      budgetedCurrency: definition.currency,
    });
  }
}

export async function generateIncomeInstancesForDefinition(
  uid: string,
  definition: IncomeDefinitionForGeneration,
  now: Date,
): Promise<void> {
  const lastGeneratedDate = await getLastIncomeInstanceDate(uid, definition.id);
  const occurrenceDates = computeIncomeOccurrenceDates(
    {
      frequency: definition.frequency,
      startDate: definition.startDate,
      dayOfMonth: definition.dayOfMonth,
      anchorDate: definition.anchorDate,
    },
    lastGeneratedDate,
    now,
  );

  for (const date of occurrenceDates) {
    const id = `${definition.id}_${formatYearMonthDay(date)}`;
    await setIncomeInstanceAt(id, {
      recurringIncomeId: definition.id,
      categoryId: definition.categoryId,
      name: definition.name,
      date,
      currency: definition.currency,
      exchangeRateToDefault: definition.exchangeRateToDefault,
      amount: definition.amount,
    });
  }
}

let generationInFlight = false;

// Launch-time catch-up scan across every active definition. Guarded against
// overlapping calls (e.g. React effect double-invoke in dev) — a redundant
// scan is harmless (see the setAt idempotency note in expenses.ts/
// incomes.ts) but there's no reason to double the Firestore round-trips.
export async function runRecurringGeneration(uid: string): Promise<void> {
  if (generationInFlight) return;
  generationInFlight = true;
  try {
    const now = new Date();
    const activeExpenseDefs = useRecurringExpensesStore
      .getState()
      .items.filter((definition) => definition.lifecycleState === 'active');
    const activeIncomeDefs = useRecurringIncomesStore
      .getState()
      .items.filter((definition) => definition.lifecycleState === 'active');

    for (const definition of activeExpenseDefs) {
      await generateExpenseInstancesForDefinition(
        uid,
        {
          id: definition.id,
          categoryId: definition.categoryId,
          name: definition.name,
          currency: definition.currency,
          exchangeRateToDefault: definition.exchangeRateToDefault,
          amount: definition.amount,
          dueDay: definition.dueDay,
          startDate: definition.startDate.toDate(),
        },
        now,
      );
    }
    for (const definition of activeIncomeDefs) {
      await generateIncomeInstancesForDefinition(
        uid,
        {
          id: definition.id,
          categoryId: definition.categoryId,
          name: definition.name,
          currency: definition.currency,
          exchangeRateToDefault: definition.exchangeRateToDefault,
          amount: definition.amount,
          frequency: definition.frequency,
          dayOfMonth: definition.dayOfMonth,
          anchorDate: definition.anchorDate ? definition.anchorDate.toDate() : null,
          startDate: definition.startDate.toDate(),
        },
        now,
      );
    }
  } catch (error) {
    // This is a fire-and-forget background scan (_layout.tsx never awaits
    // or .catch()es its call), so an unhandled rejection here would
    // otherwise crash/surface as an uncaught promise error rather than a
    // normal one. Reported live: signing out mid-scan lets an in-flight
    // getDocs() call (inside getLastExpenseInstanceDate/
    // getLastIncomeInstanceDate) reject with permission-denied once the
    // uid it was querying for stops being valid. Harmless either way — the
    // next app launch's catch-up scan picks up whatever this run didn't
    // finish, per the existing offline-hang Known Issue on this same
    // generation path.
    console.warn('[recurring-generation] catch-up scan failed:', error);
  } finally {
    generationInFlight = false;
  }
}
