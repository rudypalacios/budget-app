// Mocks first — same idiom as currencies.test.ts/user-settings.test.ts.
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
  useUserSettingsStore: {
    getState: () => ({ data: { trashRetentionDays: mockTrashRetentionDays } }),
  },
}));

// Avoids pulling in the real session.ts -> @/lib/firebase/auth -> the native
// @react-native-firebase/app module (not available under Jest) — this file
// now imports recomputeBudgetRecommendation (via recurring-expenses.ts),
// which reads useSessionStore.
jest.mock('@/store/session', () => ({
  useSessionStore: { getState: () => ({ uid: 'test-uid' }) },
}));

import {
  archiveExpense,
  purgeExpense,
  restoreExpense,
  setExpenseGroupId,
  subscribeExpenses,
  trashExpense,
  useExpensesStore,
} from './expenses';
/* eslint-enable import/first */

beforeAll(() => {
  subscribeExpenses('test-uid');
});

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockTrashRetentionDays = 30;
  useExpensesStore.setState({
    items: [],
    isLoading: false,
    error: null,
    fromCache: false,
    hasPendingWrites: false,
  });
});

describe('archiveExpense', () => {
  it('sets lifecycleState to archived and clears trash fields', async () => {
    await archiveExpense('e1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/e1',
      expect.objectContaining({
        lifecycleState: 'archived',
        trashedFromState: null,
        trashedAt: null,
        purgeAt: null,
      }),
    );
  });
});

describe('trashExpense', () => {
  it("captures the record's current lifecycleState as trashedFromState and reads trashRetentionDays from settings", async () => {
    useExpensesStore.setState({ items: [{ id: 'e1', lifecycleState: 'active' } as never] });
    mockTrashRetentionDays = 45;

    await trashExpense('e1');

    const [path, patch] = mockUpdateDoc.mock.calls[0];
    expect(path).toBe('users/test-uid/expenses/e1');
    expect(patch).toMatchObject({ lifecycleState: 'trashed', trashedFromState: 'active' });
    // toTimestamp() is a type-only cast (src/lib/timestamp.ts) — at runtime
    // these are still plain Date objects, not real Timestamp instances.
    const trashedAt = patch.trashedAt as unknown as Date;
    const purgeAt = patch.purgeAt as unknown as Date;
    expect(purgeAt).toEqual(new Date(trashedAt.getTime() + 45 * 24 * 60 * 60 * 1000));
  });

  it('throws for an id that is not in the store', () => {
    expect(() => trashExpense('missing')).toThrow();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('restoreExpense', () => {
  it('restores to trashedFromState and clears trash fields', async () => {
    useExpensesStore.setState({
      items: [
        {
          id: 'e1',
          lifecycleState: 'trashed',
          trashedFromState: 'archived',
          archivedAt: null,
        } as never,
      ],
    });

    await restoreExpense('e1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/e1',
      expect.objectContaining({
        lifecycleState: 'archived',
        trashedFromState: null,
        trashedAt: null,
        purgeAt: null,
      }),
    );
  });

  it('throws when the record is not currently trashed', () => {
    useExpensesStore.setState({
      items: [{ id: 'e1', lifecycleState: 'active', trashedFromState: null } as never],
    });

    expect(() => restoreExpense('e1')).toThrow();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('purgeExpense', () => {
  it('deletes the doc', async () => {
    await purgeExpense('e1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/expenses/e1');
  });
});

describe('setExpenseGroupId', () => {
  it('writes the given recurringGroupId', async () => {
    await setExpenseGroupId('e1', 'g1');

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/e1', {
      recurringGroupId: 'g1',
    });
  });

  it('clears the group when passed null', async () => {
    await setExpenseGroupId('e1', null);

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/e1', {
      recurringGroupId: null,
    });
  });
});
