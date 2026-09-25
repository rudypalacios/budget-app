import {
  canDeleteCategory,
  collectArchivedRecords,
  collectTrashedRecords,
  daysUntilPurge,
} from './lifecycle-records';
import type { WithId } from '@/lib/firebase/firestore.types';
import type {
  Category,
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
    categoryId: 'cat-1',
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

function recurringExpenseDefinition(
  overrides: Partial<WithId<RecurringExpense>> = {},
): WithId<RecurringExpense> {
  return {
    id: 'rexp-1',
    name: 'Rent',
    categoryId: 'cat-1',
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

function recurringIncomeDefinition(
  overrides: Partial<WithId<RecurringIncome>> = {},
): WithId<RecurringIncome> {
  return {
    id: 'rinc-1',
    name: 'Salary',
    categoryId: 'cat-1',
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

function category(overrides: Partial<WithId<Category>> = {}): WithId<Category> {
  return {
    id: 'cat-1',
    name: 'Subscriptions',
    type: 'expense',
    color: null,
    icon: null,
    order: 0,
    isSystemDefault: false,
    lifecycleState: 'active',
    monthlyBudget: null,
    createdAt: fakeTimestamp(new Date(2026, 0, 1)),
    updatedAt: fakeTimestamp(new Date(2026, 0, 1)),
    ...overrides,
  };
}

describe('collectArchivedRecords', () => {
  it('includes only archived records across all five types, sorted newest-first', () => {
    const expenses = [
      oneTimeExpense({
        id: 'e1',
        lifecycleState: 'archived',
        archivedAt: fakeTimestamp(new Date(2026, 6, 10)),
      }),
      oneTimeExpense({ id: 'e2', lifecycleState: 'active' }),
      oneTimeExpense({
        id: 'e3',
        lifecycleState: 'trashed',
        trashedAt: fakeTimestamp(new Date(2026, 6, 5)),
      }),
    ];
    const incomes = [
      oneTimeIncome({
        id: 'i1',
        lifecycleState: 'archived',
        archivedAt: fakeTimestamp(new Date(2026, 6, 15)),
      }),
    ];
    const recurringExpenses = [
      recurringExpenseDefinition({
        id: 'r1',
        lifecycleState: 'archived',
        archivedAt: fakeTimestamp(new Date(2026, 6, 1)),
      }),
    ];
    const recurringIncomes = [
      recurringIncomeDefinition({
        id: 'r2',
        lifecycleState: 'archived',
        archivedAt: fakeTimestamp(new Date(2026, 6, 20)),
      }),
    ];
    const categories = [
      category({
        id: 'c1',
        lifecycleState: 'archived',
        updatedAt: fakeTimestamp(new Date(2026, 6, 12)),
      }),
      category({ id: 'c2', lifecycleState: 'active' }),
    ];

    const records = collectArchivedRecords(
      expenses,
      incomes,
      recurringExpenses,
      recurringIncomes,
      categories,
    );

    expect(records.map((r) => r.id)).toEqual(['r2', 'i1', 'c1', 'e1', 'r1']);
    expect(records.every((r) => r.purgeAt === null)).toBe(true);
  });

  it('falls back to updatedAt for an archived category (no archivedAt field exists on Category)', () => {
    const cat = category({
      id: 'c1',
      lifecycleState: 'archived',
      updatedAt: fakeTimestamp(new Date(2026, 3, 5)),
    });

    const records = collectArchivedRecords([], [], [], [], [cat]);

    expect(records).toEqual([
      {
        recordType: 'category',
        id: 'c1',
        name: 'Subscriptions',
        statusDate: new Date(2026, 3, 5),
        purgeAt: null,
      },
    ]);
  });

  it('returns an empty list when nothing is archived', () => {
    expect(collectArchivedRecords([], [], [], [], [])).toEqual([]);
  });
});

describe('collectTrashedRecords', () => {
  it('includes only trashed records across the four trashable types, with purgeAt carried through', () => {
    const purgeAt = fakeTimestamp(new Date(2026, 7, 1));
    const expenses = [
      oneTimeExpense({
        id: 'e1',
        lifecycleState: 'trashed',
        trashedAt: fakeTimestamp(new Date(2026, 6, 1)),
        purgeAt,
      }),
      oneTimeExpense({ id: 'e2', lifecycleState: 'archived' }),
    ];

    const records = collectTrashedRecords(expenses, [], [], []);

    expect(records).toEqual([
      {
        recordType: 'expense',
        id: 'e1',
        name: 'Groceries',
        statusDate: new Date(2026, 6, 1),
        purgeAt: new Date(2026, 7, 1),
      },
    ]);
  });

  it('never includes categories, even conceptually — the function takes no categories argument', () => {
    // Type-level guarantee (Category.lifecycleState can't be 'trashed' at
    // all), asserted here by simply confirming the four-collection result
    // shape has no way to surface one.
    expect(collectTrashedRecords([], [], [], [])).toEqual([]);
  });
});

describe('daysUntilPurge', () => {
  it('rounds up to whole days remaining', () => {
    const now = new Date(2026, 6, 1, 12, 0, 0);
    expect(daysUntilPurge(new Date(2026, 6, 3, 12, 0, 0), now)).toBe(2);
    expect(daysUntilPurge(new Date(2026, 6, 1, 18, 0, 0), now)).toBe(1);
  });

  it('returns 0 or negative once purgeAt has already passed', () => {
    const now = new Date(2026, 6, 5);
    expect(daysUntilPurge(new Date(2026, 6, 5), now)).toBe(0);
    expect(daysUntilPurge(new Date(2026, 6, 1), now)).toBeLessThan(0);
  });
});

describe('canDeleteCategory', () => {
  it('allows deletion when nothing references the category', () => {
    expect(canDeleteCategory('cat-empty', [], [], [], [])).toEqual({
      allowed: true,
      blockingCount: 0,
    });
  });

  it('blocks deletion when an active record references the category', () => {
    const expenses = [oneTimeExpense({ categoryId: 'cat-1', lifecycleState: 'active' })];
    expect(canDeleteCategory('cat-1', expenses, [], [], [])).toEqual({
      allowed: false,
      blockingCount: 1,
    });
  });

  it('blocks deletion even when the only reference is archived or trashed-but-not-purged', () => {
    const expenses = [
      oneTimeExpense({ id: 'e1', categoryId: 'cat-1', lifecycleState: 'archived' }),
      oneTimeExpense({ id: 'e2', categoryId: 'cat-1', lifecycleState: 'trashed' }),
    ];
    const incomes = [oneTimeIncome({ categoryId: 'cat-1', lifecycleState: 'trashed' })];

    expect(canDeleteCategory('cat-1', expenses, incomes, [], [])).toEqual({
      allowed: false,
      blockingCount: 3,
    });
  });

  it('counts references across all four collections', () => {
    const expenses = [oneTimeExpense({ categoryId: 'cat-1' })];
    const incomes = [oneTimeIncome({ categoryId: 'cat-1' })];
    const recurringExpenses = [recurringExpenseDefinition({ categoryId: 'cat-1' })];
    const recurringIncomes = [recurringIncomeDefinition({ categoryId: 'cat-1' })];

    expect(
      canDeleteCategory('cat-1', expenses, incomes, recurringExpenses, recurringIncomes),
    ).toEqual({
      allowed: false,
      blockingCount: 4,
    });
  });
});
