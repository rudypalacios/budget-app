import { computeBudgetRecommendation, suggestCategoryMonthlyBudget } from './budget-recommendation';
import type { RecurringExpense, Timestamp } from '@/types/firestore';

function asDate(value: Timestamp | null): Date | null {
  return value as unknown as Date | null;
}

describe('computeBudgetRecommendation', () => {
  const now = new Date(2026, 5, 1);

  it('returns status none with a null average when there is no paid history yet', () => {
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [],
      budgetedAmount: 200,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.rollingAverageAmount).toBeNull();
    expect(result.sampleSize).toBe(0);
    expect(result.suggestedBudgetedAmount).toBeNull();
    expect(result.status).toBe('none');
  });

  it('returns status none when the drift is below both thresholds', () => {
    // avg 205 vs budgeted 200: diff 5, well under the 20 floor.
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [200, 210],
      budgetedAmount: 200,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.rollingAverageAmount).toBe(205);
    expect(result.status).toBe('none');
  });

  it('returns status none when diff exceeds the floor but not the percent threshold', () => {
    // avg 1025 vs budgeted 1000: diff 25 (over the 20 floor), but only 2.5% (under 10%).
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [1025],
      budgetedAmount: 1000,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.status).toBe('none');
  });

  it('returns status none when diff exceeds the percent threshold but not the floor', () => {
    // avg 11 vs budgeted 10: diff 1 (10%, meets the percent threshold), but under the 20 floor.
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [11, 11],
      budgetedAmount: 10,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.status).toBe('none');
  });

  it('returns status pending when both drift conditions hold', () => {
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [250, 250],
      budgetedAmount: 200,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.rollingAverageAmount).toBe(250);
    expect(result.suggestedBudgetedAmount).toBe(250);
    expect(result.status).toBe('pending');
    expect(asDate(result.computedAt)).toEqual(now);
  });

  it('caps the sample size at whatever was passed in (caller is responsible for limiting to 6)', () => {
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [100, 100, 100, 100, 100, 100],
      budgetedAmount: 100,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.sampleSize).toBe(6);
  });

  it('stays dismissed when the average has not drifted further than it had at dismissal', () => {
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [250, 250],
      budgetedAmount: 200,
      now,
      previousStatus: 'dismissed',
      dismissedAtAverageAmount: 260,
    });

    expect(result.status).toBe('dismissed');
    expect(result.dismissedAtAverageAmount).toBe(260);
  });

  it('re-surfaces as pending once the average drifts further than it had at dismissal', () => {
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [300, 300],
      budgetedAmount: 200,
      now,
      previousStatus: 'dismissed',
      dismissedAtAverageAmount: 250,
    });

    expect(result.status).toBe('pending');
    expect(result.dismissedAtAverageAmount).toBeNull();
  });
});

describe('suggestCategoryMonthlyBudget', () => {
  const baseDefinition: Omit<RecurringExpense, 'categoryId' | 'amount' | 'currency' | 'exchangeRateToDefault'> = {
    name: 'Test',
    dueDay: 1,
    startDate: new Date() as unknown as RecurringExpense['startDate'],
    remindersEnabled: null,
    reminderLeadDays: null,
    budgetRecommendation: {
      rollingAverageAmount: null,
      sampleSize: 0,
      computedAt: null,
      suggestedBudgetedAmount: null,
      status: 'none',
      dismissedAt: null,
      dismissedAtAverageAmount: null,
    },
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: new Date() as unknown as RecurringExpense['createdAt'],
    updatedAt: new Date() as unknown as RecurringExpense['updatedAt'],
  };

  it('returns null when the category has no active recurring expenses', () => {
    const result = suggestCategoryMonthlyBudget('cat-1', [], 'GTQ');
    expect(result).toBeNull();
  });

  it('sums amounts already in the default currency', () => {
    const definitions: RecurringExpense[] = [
      { ...baseDefinition, categoryId: 'cat-1', amount: 50, currency: 'GTQ', exchangeRateToDefault: 1 },
      { ...baseDefinition, categoryId: 'cat-1', amount: 100, currency: 'GTQ', exchangeRateToDefault: 1 },
      { ...baseDefinition, categoryId: 'cat-2', amount: 999, currency: 'GTQ', exchangeRateToDefault: 1 },
    ];

    const result = suggestCategoryMonthlyBudget('cat-1', definitions, 'GTQ');
    expect(result).toBe(150);
  });

  it('converts a foreign-currency definition using its exchangeRateToDefault', () => {
    const definitions: RecurringExpense[] = [
      { ...baseDefinition, categoryId: 'cat-1', amount: 10, currency: 'USD', exchangeRateToDefault: 7.5 },
    ];

    const result = suggestCategoryMonthlyBudget('cat-1', definitions, 'GTQ');
    expect(result).toBe(75);
  });
});
