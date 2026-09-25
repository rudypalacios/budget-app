import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment;

const OWNER_UID = 'owner-uid';
const OTHER_UID = 'other-uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'rules-test-lighthouse-budget-app',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

const ownerDb = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const otherDb = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('owner-only access (NFR-7)', () => {
  test('owner can read their own settings doc', async () => {
    await seed(`users/${OWNER_UID}`, { defaultCurrency: 'GTQ' });
    await assertSucceeds(getDoc(doc(ownerDb(), `users/${OWNER_UID}`)));
  });

  test("a different authenticated user cannot read someone else's settings doc", async () => {
    await seed(`users/${OWNER_UID}`, { defaultCurrency: 'GTQ' });
    await assertFails(getDoc(doc(otherDb(), `users/${OWNER_UID}`)));
  });

  test('an unauthenticated request cannot read any data', async () => {
    await seed(`users/${OWNER_UID}`, { defaultCurrency: 'GTQ' });
    await assertFails(getDoc(doc(anonDb(), `users/${OWNER_UID}`)));
  });
});

describe('categories: Active/Archived only, no Trash (data-model.md §4)', () => {
  test('create with lifecycleState "active" succeeds', async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), `users/${OWNER_UID}/categories/cat1`), {
        name: 'Groceries',
        type: 'expense',
        lifecycleState: 'active',
      }),
    );
  });

  test('create with lifecycleState "trashed" is rejected', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER_UID}/categories/cat2`), {
        name: 'Groceries',
        type: 'expense',
        lifecycleState: 'trashed',
      }),
    );
  });
});

describe('recurringExpenses: lifecycle state machine (FR-4a-4e)', () => {
  const path = `users/${OWNER_UID}/recurringExpenses/rec1`;
  const baseDoc = {
    name: 'Electric bill',
    categoryId: 'cat1',
    amount: 200,
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    dueDay: 15,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };

  test('create as active succeeds', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), path), baseDoc));
  });

  test('create as trashed without trashedAt/purgeAt/trashedFromState is rejected', async () => {
    await assertFails(setDoc(doc(ownerDb(), path), { ...baseDoc, lifecycleState: 'trashed' }));
  });

  test('trashing an active doc with proper metadata succeeds', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(
      updateDoc(doc(ownerDb(), path), {
        lifecycleState: 'trashed',
        trashedFromState: 'active',
        trashedAt: new Date(),
        purgeAt: new Date(),
      }),
    );
  });

  test('restoring to a state that does not match trashedFromState is rejected', async () => {
    await seed(path, {
      ...baseDoc,
      lifecycleState: 'trashed',
      trashedFromState: 'active',
      trashedAt: new Date(),
      purgeAt: new Date(),
    });
    await assertFails(
      updateDoc(doc(ownerDb(), path), {
        lifecycleState: 'archived',
        trashedFromState: null,
        trashedAt: null,
        purgeAt: null,
      }),
    );
  });

  test('restoring to the correct trashedFromState succeeds', async () => {
    await seed(path, {
      ...baseDoc,
      lifecycleState: 'trashed',
      trashedFromState: 'active',
      trashedAt: new Date(),
      purgeAt: new Date(),
    });
    await assertSucceeds(
      updateDoc(doc(ownerDb(), path), {
        lifecycleState: 'active',
        trashedFromState: null,
        trashedAt: null,
        purgeAt: null,
      }),
    );
  });

  test('deleting an active doc directly is rejected (must go through Trash)', async () => {
    await seed(path, baseDoc);
    await assertFails(deleteDoc(doc(ownerDb(), path)));
  });

  test('deleting a trashed doc succeeds (permanent purge)', async () => {
    await seed(path, {
      ...baseDoc,
      lifecycleState: 'trashed',
      trashedFromState: 'active',
      trashedAt: new Date(),
      purgeAt: new Date(),
    });
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });

  test('changing currency on update succeeds — a recurring definition is a live, re-editable template (data-model.md §5), unlike a written instance/one-time record', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(
      updateDoc(doc(ownerDb(), path), { currency: 'USD', exchangeRateToDefault: 0.13 }),
    );
  });
});

describe('expenses: field immutability (FR-16, data-model.md §8)', () => {
  const path = `users/${OWNER_UID}/expenses/exp1`;
  const baseDoc = {
    kind: 'recurringInstance',
    recurringExpenseId: 'rec1',
    name: 'Electric bill - July',
    categoryId: 'cat1',
    date: new Date(),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 200,
    rateSource: 'manual',
    budgetedAmount: 200,
    budgetedCurrency: 'GTQ',
    amount: null,
    paid: false,
    paidDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };

  test('create succeeds', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), path), baseDoc));
  });

  test('changing exchangeRateToDefault on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { exchangeRateToDefault: 2 }));
  });

  test('changing currency on update is rejected (Stage 11 — locked alongside exchangeRateToDefault)', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { currency: 'USD' }));
  });

  test('changing budgetedAmount on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { budgetedAmount: 999 }));
  });

  test('changing budgetedCurrency on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { budgetedCurrency: 'USD' }));
  });

  test('changing kind on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { kind: 'oneTime' }));
  });

  test('changing recurringExpenseId on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { recurringExpenseId: 'rec2' }));
  });

  test('marking paid (unrelated fields) succeeds', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(
      updateDoc(doc(ownerDb(), path), { paid: true, paidDate: new Date(), amount: 250 }),
    );
  });

  test('deleting a non-trashed instance is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('incomes: field immutability (FR-16) and paid/unpaid parity (FR-5c)', () => {
  const path = `users/${OWNER_UID}/incomes/inc1`;
  const baseDoc = {
    kind: 'recurringInstance',
    recurringIncomeId: 'recInc1',
    name: 'Salary',
    categoryId: 'cat2',
    date: new Date(),
    currency: 'GTQ',
    exchangeRateToDefault: 1,
    amountInDefaultCurrency: 5000,
    rateSource: 'manual',
    amount: 5000,
    paid: false,
    paidDate: null,
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };

  test('changing exchangeRateToDefault on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { exchangeRateToDefault: 2 }));
  });

  test('changing currency on update is rejected (Stage 11 — locked alongside exchangeRateToDefault)', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { currency: 'USD' }));
  });

  test('changing recurringIncomeId on update is rejected', async () => {
    await seed(path, baseDoc);
    await assertFails(updateDoc(doc(ownerDb(), path), { recurringIncomeId: 'recInc2' }));
  });

  test('marking received (unrelated fields) succeeds', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(updateDoc(doc(ownerDb(), path), { paid: true, paidDate: new Date() }));
  });
});

describe('currencies: owner-only CRUD, no lifecycle machinery (Stage 11 redesign, docs/data-model.md §3a)', () => {
  const path = `users/${OWNER_UID}/currencies/EUR`;
  const baseDoc = {
    exchangeRateToDefault: 8.78,
    rateSource: 'fetched',
    status: 'ok',
  };

  test('owner can create', async () => {
    await assertSucceeds(setDoc(doc(ownerDb(), path), baseDoc));
  });

  test("a different authenticated user cannot create in another owner's subcollection", async () => {
    await assertFails(setDoc(doc(otherDb(), path), baseDoc));
  });

  test('owner can update the rate (e.g. refreshing it)', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(
      updateDoc(doc(ownerDb(), path), { exchangeRateToDefault: 9.01, status: 'ok' }),
    );
  });

  test('owner can mark it stale (defaultCurrency-change batch write)', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(updateDoc(doc(ownerDb(), path), { status: 'stale' }));
  });

  test('owner can delete (removing a previously-added currency)', async () => {
    await seed(path, baseDoc);
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });

  test("a different authenticated user cannot read another owner's added currency", async () => {
    await seed(path, baseDoc);
    await assertFails(getDoc(doc(otherDb(), path)));
  });
});
