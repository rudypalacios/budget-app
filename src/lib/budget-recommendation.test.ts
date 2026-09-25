import { canRevertRecommendation, computeBudgetRecommendation, isRecommendationPending } from './budget-recommendation';
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

  it('ignores a single anomalous bill instead of recommending a change (D12)', () => {
    // 5 normal months at 300 plus one Q2,000 billing error: a plain average
    // (583) would flag drift; the robust average stays at 300.
    const result = computeBudgetRecommendation({
      paidInstanceAmounts: [300, 300, 2000, 300, 300, 300],
      budgetedAmount: 300,
      now,
      previousStatus: 'none',
      dismissedAtAverageAmount: null,
    });

    expect(result.rollingAverageAmount).toBe(300);
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

describe('isRecommendationPending', () => {
  const base = { rollingAverageAmount: 112, suggestedBudgetedAmount: 112 } as const;

  it('is true only when pending with a suggested amount', () => {
    expect(isRecommendationPending({ ...base, status: 'pending' } as RecurringExpense['budgetRecommendation'])).toBe(true);
    expect(
      isRecommendationPending({ ...base, status: 'pending', suggestedBudgetedAmount: null } as RecurringExpense['budgetRecommendation']),
    ).toBe(false);
    for (const status of ['accepted', 'dismissed', 'stale'] as const) {
      expect(isRecommendationPending({ ...base, status } as RecurringExpense['budgetRecommendation'])).toBe(false);
    }
  });
});

describe('canRevertRecommendation', () => {
  const pending = {
    rollingAverageAmount: 112,
    sampleSize: 6,
    computedAt: null,
    suggestedBudgetedAmount: 112,
    status: 'pending' as const,
    dismissedAt: null,
    dismissedAtAverageAmount: null,
  };
  const snapshot = { amount: 85, budgetRecommendation: pending };

  it('allows undoing an accept while the definition still holds the accepted amount', () => {
    const current = { amount: 112, exchangeRateToDefault: 1, budgetRecommendation: { ...pending, status: 'accepted' as const } };
    expect(canRevertRecommendation(current, snapshot, 'accepted')).toBe(true);
  });

  it('handles a foreign-currency accept (amount = suggested / rate)', () => {
    const current = { amount: 112 / 7.7, exchangeRateToDefault: 7.7, budgetRecommendation: { ...pending, status: 'accepted' as const } };
    expect(canRevertRecommendation(current, snapshot, 'accepted')).toBe(true);
  });

  it('refuses once the amount was edited after accepting', () => {
    const current = { amount: 120, exchangeRateToDefault: 1, budgetRecommendation: { ...pending, status: 'accepted' as const } };
    expect(canRevertRecommendation(current, snapshot, 'accepted')).toBe(false);
  });

  it('refuses once a recompute changed the status', () => {
    const current = { amount: 112, exchangeRateToDefault: 1, budgetRecommendation: { ...pending, status: 'pending' as const } };
    expect(canRevertRecommendation(current, snapshot, 'accepted')).toBe(false);
  });

  it('allows undoing a keep while the amount is unchanged', () => {
    const current = { amount: 85, exchangeRateToDefault: 1, budgetRecommendation: { ...pending, status: 'dismissed' as const } };
    expect(canRevertRecommendation(current, snapshot, 'dismissed')).toBe(true);
    expect(canRevertRecommendation({ ...current, amount: 90 }, snapshot, 'dismissed')).toBe(false);
  });
});
