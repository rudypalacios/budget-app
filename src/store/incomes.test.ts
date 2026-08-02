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

import { archiveIncome, purgeIncome, restoreIncome, subscribeIncomes, trashIncome, useIncomesStore } from './incomes';
/* eslint-enable import/first */

beforeAll(() => {
  subscribeIncomes('test-uid');
});

beforeEach(() => {
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockTrashRetentionDays = 30;
  useIncomesStore.setState({ items: [], isLoading: false, error: null, fromCache: false, hasPendingWrites: false });
});

describe('archiveIncome', () => {
  it('sets lifecycleState to archived and clears trash fields', async () => {
    await archiveIncome('i1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/incomes/i1',
      expect.objectContaining({ lifecycleState: 'archived', trashedFromState: null, trashedAt: null, purgeAt: null }),
    );
  });
});

describe('trashIncome', () => {
  it("captures the record's current lifecycleState as trashedFromState and reads trashRetentionDays from settings", async () => {
    useIncomesStore.setState({ items: [{ id: 'i1', lifecycleState: 'archived' } as never] });
    mockTrashRetentionDays = 10;

    await trashIncome('i1');

    const [path, patch] = mockUpdateDoc.mock.calls[0];
    expect(path).toBe('users/test-uid/incomes/i1');
    expect(patch).toMatchObject({ lifecycleState: 'trashed', trashedFromState: 'archived' });
  });

  it('throws for an id that is not in the store', () => {
    expect(() => trashIncome('missing')).toThrow();
  });
});

describe('restoreIncome', () => {
  it('restores to trashedFromState and clears trash fields', async () => {
    useIncomesStore.setState({
      items: [{ id: 'i1', lifecycleState: 'trashed', trashedFromState: 'active', archivedAt: null } as never],
    });

    await restoreIncome('i1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/incomes/i1',
      expect.objectContaining({ lifecycleState: 'active', trashedFromState: null, trashedAt: null, purgeAt: null }),
    );
  });

  it('throws when the record is not currently trashed', () => {
    useIncomesStore.setState({ items: [{ id: 'i1', lifecycleState: 'active', trashedFromState: null } as never] });

    expect(() => restoreIncome('i1')).toThrow();
  });
});

describe('purgeIncome', () => {
  it('deletes the doc', async () => {
    await purgeIncome('i1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/incomes/i1');
  });
});
