import { countCategoryItems } from './category-stats';
import type { WithId } from '@/lib/firebase/firestore.types';
import type {
  ExpenseRecord,
  IncomeRecord,
  OneTimeExpense,
  OneTimeIncome,
  RecurringExpense,
  RecurringIncome,
  Timestamp,
} from '@/types/firestore';

function fakeTimestamp(date: Date): Timestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

function oneTimeExpense(overrides: Partial<WithId<OneTimeExpense>> = {}): WithId<OneTimeExpense> {
  return {
    id: 'exp-1',
    kind: 'oneTime',
    recurringExpenseId: null,
    name: 'Groceries',
    categoryId: 'cat-1',
    date: fakeTimestamp(new Date(2026, 6, 1)),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 100,
    rateSource: 'manual',
    budgetedAmount: null,
    budgetedCurrency: null,
    amount: 100,
    paid: false,
    paidDate: null,
    recurringGroupId: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 6, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 6, 1)),
    ...overrides,
  };
}

function oneTimeIncome(overrides: Partial<WithId<OneTimeIncome>> = {}): WithId<OneTimeIncome> {
  return {
    id: 'inc-1',
    kind: 'oneTime',
    recurringIncomeId: null,
    name: 'Freelance gig',
    categoryId: 'cat-3',
    date: fakeTimestamp(new Date(2026, 6, 1)),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 500,
    rateSource: 'manual',
    amount: 500,
    paid: false,
    paidDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 6, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 6, 1)),
    ...overrides,
  };
}

function recurringExpenseDefinition(overrides: Partial<WithId<RecurringExpense>> = {}): WithId<RecurringExpense> {
  return {
    id: 'rexp-1',
    name: 'Rent',
    categoryId: 'cat-2',
    amount: 2000,
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    dueDay: 1,
    recurringGroupId: null,
    startDate: fakeTimestamp(new Date(2026, 0, 1)),
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
    createdAt: fakeTimestamp(new Date(2026, 0, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 0, 1)),
    ...overrides,
  };
}

function recurringIncomeDefinition(overrides: Partial<WithId<RecurringIncome>> = {}): WithId<RecurringIncome> {
  return {
    id: 'rinc-1',
    name: 'Salary',
    categoryId: 'cat-3',
    amount: 3000,
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    startDate: fakeTimestamp(new Date(2026, 0, 1)),
    frequency: 'monthly',
    dayOfMonth: 1,
    anchorDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
    createdAt: fakeTimestamp(new Date(2026, 0, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 0, 1)),
    ...overrides,
  };
}

describe('countCategoryItems', () => {
  it('counts active one-time expenses/incomes and active recurring definitions in the category', () => {
    const expenses: ExpenseRecord[] = [
      oneTimeExpense({ id: 'e1', categoryId: 'cat-1' }),
      oneTimeExpense({ id: 'e2', categoryId: 'cat-1' }),
      oneTimeExpense({ id: 'e3', categoryId: 'cat-9' }),
    ];
    const incomes: IncomeRecord[] = [oneTimeIncome({ id: 'i1', categoryId: 'cat-1' })];
    const recurringExpenses: RecurringExpense[] = [recurringExpenseDefinition({ id: 'r1', categoryId: 'cat-1' })];
    const recurringIncomes: RecurringIncome[] = [];

    expect(countCategoryItems('cat-1', expenses, incomes, recurringExpenses, recurringIncomes)).toBe(4);
  });

  it('excludes archived/trashed records even when the categoryId matches', () => {
    const expenses: ExpenseRecord[] = [
      oneTimeExpense({ id: 'e1', categoryId: 'cat-1', lifecycleState: 'archived' }),
      oneTimeExpense({ id: 'e2', categoryId: 'cat-1', lifecycleState: 'trashed' }),
    ];

    expect(countCategoryItems('cat-1', expenses, [], [], [])).toBe(0);
  });

  it('returns 0 for a category with no linked records', () => {
    expect(countCategoryItems('cat-empty', [], [], [], [])).toBe(0);
  });

  it('counts active recurring income definitions in the category too', () => {
    const recurringIncomes: RecurringIncome[] = [
      recurringIncomeDefinition({ id: 'r1', categoryId: 'cat-3' }),
      recurringIncomeDefinition({ id: 'r2', categoryId: 'cat-3', lifecycleState: 'archived' }),
    ];

    expect(countCategoryItems('cat-3', [], [], [], recurringIncomes)).toBe(1);
  });
});
