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

import {
  archiveRecurringIncome,
  purgeRecurringIncome,
  restoreRecurringIncome,
  subscribeRecurringIncomes,
  trashRecurringIncome,
  useRecurringIncomesStore,
} from './recurring-incomes';
/* eslint-enable import/first */

beforeAll(() => {
  subscribeRecurringIncomes('test-uid');
});

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockTrashRetentionDays = 30;
  useRecurringIncomesStore.setState({
    items: [],
    isLoading: false,
    error: null,
    fromCache: false,
    hasPendingWrites: false,
  });
});

describe('archiveRecurringIncome', () => {
  it('sets lifecycleState to archived, which stops future generation (FR-4e, filtered in recurring-generation.ts)', async () => {
    await archiveRecurringIncome('r1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringIncomes/r1',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
  });
});

describe('trashRecurringIncome', () => {
  it("captures the definition's current lifecycleState and reads trashRetentionDays from settings", async () => {
    useRecurringIncomesStore.setState({ items: [{ id: 'r1', lifecycleState: 'active' } as never] });

    await trashRecurringIncome('r1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringIncomes/r1',
      expect.objectContaining({ lifecycleState: 'trashed', trashedFromState: 'active' }),
    );
  });

  it('throws for an id that is not in the store', () => {
    expect(() => trashRecurringIncome('missing')).toThrow();
  });
});

describe('restoreRecurringIncome', () => {
  it('restores to trashedFromState and clears trash fields', async () => {
    useRecurringIncomesStore.setState({
      items: [{ id: 'r1', lifecycleState: 'trashed', trashedFromState: 'active', archivedAt: null } as never],
    });

    await restoreRecurringIncome('r1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringIncomes/r1',
      expect.objectContaining({ lifecycleState: 'active', trashedFromState: null }),
    );
  });

  it('throws when the definition is not currently trashed', () => {
    useRecurringIncomesStore.setState({
      items: [{ id: 'r1', lifecycleState: 'active', trashedFromState: null } as never],
    });

    expect(() => restoreRecurringIncome('r1')).toThrow();
  });
});

describe('purgeRecurringIncome', () => {
  it('deletes the doc', async () => {
    await purgeRecurringIncome('r1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/recurringIncomes/r1');
  });
});
