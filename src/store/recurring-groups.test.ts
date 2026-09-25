// Mocks first — same idiom as recurring-incomes.test.ts.
/* eslint-disable import/first */
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('@/lib/firebase/firestore', () => ({
  firestoreClient: {
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    setDoc: jest.fn(),
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

import {
  addRecurringGroup,
  archiveRecurringGroup,
  purgeRecurringGroup,
  renameRecurringGroup,
  restoreRecurringGroup,
  subscribeRecurringGroups,
  trashRecurringGroup,
  useRecurringGroupsStore,
} from './recurring-groups';
/* eslint-enable import/first */

beforeAll(() => {
  subscribeRecurringGroups('test-uid');
});

beforeEach(() => {
  mockAddDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockTrashRetentionDays = 30;
  useRecurringGroupsStore.setState({
    items: [],
    isLoading: false,
    error: null,
    fromCache: false,
    hasPendingWrites: false,
  });
});

describe('addRecurringGroup', () => {
  it('creates an active group with the given (trimmed) name', async () => {
    await addRecurringGroup('  Suscripciones  ');

    expect(mockAddDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringGroups',
      expect.objectContaining({ name: 'Suscripciones', lifecycleState: 'active' }),
    );
  });
});

describe('renameRecurringGroup', () => {
  it('updates the name (trimmed)', async () => {
    await renameRecurringGroup('g1', '  Streaming  ');

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/recurringGroups/g1', {
      name: 'Streaming',
    });
  });
});

describe('archiveRecurringGroup', () => {
  it('sets lifecycleState to archived — members keep their own recurringGroupId untouched', async () => {
    await archiveRecurringGroup('g1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringGroups/g1',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
  });
});

describe('trashRecurringGroup', () => {
  it("captures the group's current lifecycleState and reads trashRetentionDays from settings", async () => {
    useRecurringGroupsStore.setState({ items: [{ id: 'g1', lifecycleState: 'active' } as never] });

    await trashRecurringGroup('g1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringGroups/g1',
      expect.objectContaining({ lifecycleState: 'trashed', trashedFromState: 'active' }),
    );
  });

  it('throws for an id that is not in the store', () => {
    expect(() => trashRecurringGroup('missing')).toThrow();
  });
});

describe('restoreRecurringGroup', () => {
  it('restores to trashedFromState and clears trash fields', async () => {
    useRecurringGroupsStore.setState({
      items: [
        {
          id: 'g1',
          lifecycleState: 'trashed',
          trashedFromState: 'active',
          archivedAt: null,
        } as never,
      ],
    });

    await restoreRecurringGroup('g1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/recurringGroups/g1',
      expect.objectContaining({ lifecycleState: 'active', trashedFromState: null }),
    );
  });

  it('throws when the group is not currently trashed', () => {
    useRecurringGroupsStore.setState({
      items: [{ id: 'g1', lifecycleState: 'active', trashedFromState: null } as never],
    });

    expect(() => restoreRecurringGroup('g1')).toThrow();
  });
});

describe('purgeRecurringGroup', () => {
  it('deletes the doc', async () => {
    await purgeRecurringGroup('g1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/recurringGroups/g1');
  });
});
