/**
 * Firestore document types. Source of truth: docs/data-model.md — if these
 * ever disagree, the doc wins and this file should be updated to match.
 */

/**
 * Structurally compatible with firebase/firestore's Timestamp class, which
 * isn't a dependency yet (Firestore setup is Stage 3). Swap this for a
 * re-export of the real type once `firebase` is added — no call sites
 * should need to change, since the real class satisfies this shape.
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type CurrencyCode = string; // ISO 4217, e.g. 'GTQ', 'USD'
export type RateSource = 'manual' | 'fetched';
export type LifecycleState = 'active' | 'archived' | 'trashed';
export type ArchivableState = 'active' | 'archived';

interface TrashableLifecycle {
  lifecycleState: LifecycleState;
  trashedFromState: ArchivableState | null;
  archivedAt: Timestamp | null;
  trashedAt: Timestamp | null;
  purgeAt: Timestamp | null;
}

// --- users/{uid} — §3 ---

export interface UserSettings {
  defaultCurrency: CurrencyCode;
  language: 'es' | 'en';
  theme: 'light' | 'dark' | 'system';
  trashRetentionDays: number;
  reminders: {
    enabled: boolean;
    leadDays: number;
    timeOfDay: string | null;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- users/{uid}/categories/{categoryId} — §4 ---

export interface Category {
  name: string;
  type: 'expense' | 'income' | 'both';
  color: string | null;
  icon: string | null;
  order: number;
  isSystemDefault: boolean;
  lifecycleState: ArchivableState; // no Trash for categories — see §4
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Recurring definitions — §5 ---

export type BudgetRecommendationStatus = 'none' | 'pending' | 'dismissed' | 'accepted' | 'stale'; // set in bulk when defaultCurrency changes — see §3, §9

export interface BudgetRecommendation {
  rollingAverageAmount: number | null;
  sampleSize: number;
  computedAt: Timestamp | null;
  suggestedBudgetedAmount: number | null;
  status: BudgetRecommendationStatus;
  dismissedAt: Timestamp | null;
  dismissedAtAverageAmount: number | null;
}

export interface RecurringExpense extends TrashableLifecycle {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  dueDay: number; // 1-31; month-end clamped to last valid day, see §9
  startDate: Timestamp;
  remindersEnabled: boolean | null; // null = inherit UserSettings.reminders.enabled
  reminderLeadDays: number | null; // null = inherit UserSettings.reminders.leadDays
  budgetRecommendation: BudgetRecommendation;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RecurringIncomeFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface RecurringIncome extends TrashableLifecycle {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  startDate: Timestamp;
  frequency: RecurringIncomeFrequency;
  dayOfMonth: number | null; // used when frequency === 'monthly'
  anchorDate: Timestamp | null; // used when frequency is 'weekly' | 'biweekly'
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- One-time records + generated instances — §6 ---

interface ExpenseRecordShared extends TrashableLifecycle {
  categoryId: string;
  name: string;
  date: Timestamp;
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  amountInDefaultCurrency: number;
  rateSource: RateSource;
  paid: boolean;
  paidDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OneTimeExpense extends ExpenseRecordShared {
  kind: 'oneTime';
  recurringExpenseId: null;
  budgetedAmount: null;
  budgetedCurrency: null;
  amount: number;
}

export interface RecurringExpenseInstance extends ExpenseRecordShared {
  kind: 'recurringInstance';
  recurringExpenseId: string;
  budgetedAmount: number;
  budgetedCurrency: CurrencyCode;
  amount: number | null; // null until paid === true
  // Marks this one occurrence as intentionally not being paid this period,
  // without touching the definition/generation schedule (Stage 8, Payments
  // Dashboard). Orthogonal to paid/paidDate, same as lifecycleState is —
  // see data-model.md §12.
  skipped: boolean;
  skippedAt: Timestamp | null;
}

export type ExpenseRecord = OneTimeExpense | RecurringExpenseInstance;

interface IncomeRecordShared extends TrashableLifecycle {
  categoryId: string;
  name: string;
  date: Timestamp; // expected/due date, distinct from paidDate below (FR-5c)
  currency: CurrencyCode;
  exchangeRateToDefault: number;
  amountInDefaultCurrency: number;
  rateSource: RateSource;
  amount: number;
  paid: boolean;
  paidDate: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OneTimeIncome extends IncomeRecordShared {
  kind: 'oneTime';
  recurringIncomeId: null;
}

export interface RecurringIncomeInstance extends IncomeRecordShared {
  kind: 'recurringInstance';
  recurringIncomeId: string;
  // See RecurringExpenseInstance.skipped — data-model.md §12.
  skipped: boolean;
  skippedAt: Timestamp | null;
}

export type IncomeRecord = OneTimeIncome | RecurringIncomeInstance;

// --- Rolling-average drift threshold — §9 ---
// Both conditions must hold before a budget recommendation is surfaced.

export const ROLLING_AVERAGE_DRIFT_PERCENT = 0.1; // 10%
export const ROLLING_AVERAGE_DRIFT_FLOOR = 20; // in default currency
