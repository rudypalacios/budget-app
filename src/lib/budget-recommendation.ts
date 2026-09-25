import { robustAverage } from './estimate';
import { toTimestamp } from './timestamp';
import {
  ROLLING_AVERAGE_DRIFT_FLOOR,
  ROLLING_AVERAGE_DRIFT_PERCENT,
  type BudgetRecommendation,
  type BudgetRecommendationStatus,
} from '@/types/firestore';

// Pure rolling-average/drift math for FR-6a-6d (docs/data-model.md §9),
// kept separate from Firestore/store calls so it's directly unit-testable —
// same split as src/lib/lifecycle-transitions.ts.

// FR-6b/6c: both the %-threshold and the floor must hold, so a small swing
// on a small recurring bill (e.g. a $5 bill moving 15%, a $0.75 difference)
// doesn't surface noise.
function hasDrifted(rollingAverageAmount: number, budgetedAmount: number): boolean {
  const diff = Math.abs(rollingAverageAmount - budgetedAmount);
  return diff / budgetedAmount > ROLLING_AVERAGE_DRIFT_PERCENT && diff > ROLLING_AVERAGE_DRIFT_FLOOR;
}

export type ComputeBudgetRecommendationParams = {
  // amountInDefaultCurrency of up to the last 6 paid instances, most-recent
  // order doesn't matter here since only the average is taken.
  paidInstanceAmounts: number[];
  budgetedAmount: number;
  now: Date;
  previousStatus: BudgetRecommendationStatus;
  dismissedAtAverageAmount: number | null;
};

// data-model.md §9: "dismissedAtAverageAmount lets a dismissal re-surface
// once the average drifts further" — interpreted here as: a dismissed
// recommendation stays dismissed unless the rolling average has since moved
// even further from the budgeted amount than it had at the time of
// dismissal (not just "changed at all").
export function computeBudgetRecommendation({
  paidInstanceAmounts,
  budgetedAmount,
  now,
  previousStatus,
  dismissedAtAverageAmount,
}: ComputeBudgetRecommendationParams): BudgetRecommendation {
  // D12: the app's standard estimate — a single anomalous bill (e.g. a
  // billing error) is excluded instead of triggering a false recommendation.
  const rollingAverageAmount = robustAverage(paidInstanceAmounts);
  const sampleSize = paidInstanceAmounts.length;

  if (rollingAverageAmount === null || !hasDrifted(rollingAverageAmount, budgetedAmount)) {
    return {
      rollingAverageAmount,
      sampleSize,
      computedAt: toTimestamp(now),
      suggestedBudgetedAmount: rollingAverageAmount,
      status: 'none',
      dismissedAt: null,
      dismissedAtAverageAmount: null,
    };
  }

  const staysDismissed =
    previousStatus === 'dismissed' &&
    dismissedAtAverageAmount !== null &&
    Math.abs(rollingAverageAmount - budgetedAmount) <= Math.abs(dismissedAtAverageAmount - budgetedAmount);

  if (staysDismissed) {
    return {
      rollingAverageAmount,
      sampleSize,
      computedAt: toTimestamp(now),
      suggestedBudgetedAmount: rollingAverageAmount,
      status: 'dismissed',
      dismissedAt: toTimestamp(now),
      dismissedAtAverageAmount,
    };
  }

  return {
    rollingAverageAmount,
    sampleSize,
    computedAt: toTimestamp(now),
    suggestedBudgetedAmount: rollingAverageAmount,
    status: 'pending',
    dismissedAt: null,
    dismissedAtAverageAmount: null,
  };
}

// The one definition of "there is a recommendation to act on" — shared by
// BudgetRecommendationBadge (renders it) and the Budget card's recurring
// rows (hide the plain average line when the badge already shows it).
export function isRecommendationPending(recommendation: BudgetRecommendation): boolean {
  return recommendation.status === 'pending' && recommendation.suggestedBudgetedAmount !== null;
}

export type RecommendationAction = 'accepted' | 'dismissed';

// What Undo restores: the definition's amount and recommendation exactly as
// they were before Accept/Keep (fase 7).
export type RecommendationSnapshot = {
  amount: number;
  budgetRecommendation: BudgetRecommendation;
};

type RevertableDefinition = RecommendationSnapshot & { exchangeRateToDefault: number };

// Undo is only safe if the definition still looks exactly like the action
// left it. If anything moved it on since (a recompute, an edit from another
// device), restoring the snapshot would overwrite that newer state — so the
// undo quietly does nothing instead (spec phase 7, safety guard).
export function canRevertRecommendation(
  current: RevertableDefinition,
  snapshot: RecommendationSnapshot,
  action: RecommendationAction,
): boolean {
  if (current.budgetRecommendation.status !== action) return false;

  if (action === 'dismissed') {
    return current.amount === snapshot.amount;
  }

  // Accept set amount = suggested / exchangeRateToDefault (see
  // acceptBudgetRecommendation); compare with a tolerance since that's a
  // floating-point division.
  const suggested = snapshot.budgetRecommendation.suggestedBudgetedAmount;
  if (suggested === null) return false;
  const acceptedAmount = suggested / current.exchangeRateToDefault;
  return Math.abs(current.amount - acceptedAmount) < 1e-6;
}
