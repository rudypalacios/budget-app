// Mocks first — same idiom as expenses.test.ts.
/* eslint-disable import/first */
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('@/lib/firebase/firestore', () => ({
  firestoreClient: {
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    setDoc: jest.fn(),
    addDoc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    batchUpdate: jest.fn(),
    subscribeDoc: jest.fn(),
    subscribeCollection: jest.fn().mockReturnValue(() => {}),
  },
}));

let mockTrashRetentionDays = 30;
jest.mock('@/store/user-settings', () => ({
  useUserSettingsStore: { getState: () => ({ data: { trashRetentionDays: mockTrashRetentionDays } }) },
}));

// Avoids pulling in the real session.ts -> @/lib/firebase/auth -> the native
// @react-native-firebase/app module (not available under Jest) — this file
// now imports recomputeBudgetRecommendation, which reads useSessionStore.
jest.mock('@/store/session', () => ({
  useSessionStore: { getState: () => ({ uid: 'test-uid' }) },
}));

import {
  archiveRecurringExpense,
  purgeRecurringExpense,
  restoreRecurringExpense,
  subscribeRecurringExpenses,
  trashRecurringExpense,
  useRecurringExpensesStore,
} from './recurring-expenses';
/* eslint-enable import/first */

beforeAll(() => {
  subscribeRecurringExpenses('test-uid');
});

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockTrashRetentionDays = 30;
  useRecurringExpensesStore.setState({
    items: [],
    isLoading: false,
    error: null,
    fromCache: false,
    hasPendingWrites: false,
  });
});

describe('archiveRecurringExpense', () => {
  it('sets lifecycleState to archived, which stops future generation (FR-4e, filtered in recurring-generation.ts)', async () => {
    await archiveRecurringExpense('r1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringExpenses/r1',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
  });
});

describe('trashRecurringExpense', () => {
  it("captures the definition's current lifecycleState and reads trashRetentionDays from settings", async () => {
    useRecurringExpensesStore.setState({ items: [{ id: 'r1', lifecycleState: 'active' } as never] });

    await trashRecurringExpense('r1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringExpenses/r1',
      expect.objectContaining({ lifecycleState: 'trashed', trashedFromState: 'active' }),
    );
  });

  it('throws for an id that is not in the store', () => {
    expect(() => trashRecurringExpense('missing')).toThrow();
  });
});

describe('restoreRecurringExpense', () => {
  it('restores to trashedFromState and clears trash fields', async () => {
    useRecurringExpensesStore.setState({
      items: [{ id: 'r1', lifecycleState: 'trashed', trashedFromState: 'active', archivedAt: null } as never],
    });

    await restoreRecurringExpense('r1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringExpenses/r1',
      expect.objectContaining({ lifecycleState: 'active', trashedFromState: null }),
    );
  });

  it('throws when the definition is not currently trashed', () => {
    useRecurringExpensesStore.setState({
      items: [{ id: 'r1', lifecycleState: 'active', trashedFromState: null } as never],
    });

    expect(() => restoreRecurringExpense('r1')).toThrow();
  });
});

describe('purgeRecurringExpense', () => {
  it('deletes the doc', async () => {
    await purgeRecurringExpense('r1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/recurringExpenses/r1');
  });
});
