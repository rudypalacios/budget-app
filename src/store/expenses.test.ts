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
  useUserSettingsStore: { getState: () => ({ data: { trashRetentionDays: mockTrashRetentionDays } }) },
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
  archiveOrTrashExpenseGroup,
  purgeExpense,
  restoreExpense,
  setExpenseGroupParent,
  setExpensePaid,
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
  useExpensesStore.setState({ items: [], isLoading: false, error: null, fromCache: false, hasPendingWrites: false });
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
      items: [{ id: 'e1', lifecycleState: 'trashed', trashedFromState: 'archived', archivedAt: null } as never],
    });

    await restoreExpense('e1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/e1',
      expect.objectContaining({ lifecycleState: 'archived', trashedFromState: null, trashedAt: null, purgeAt: null }),
    );
  });

  it('throws when the record is not currently archived or trashed', () => {
    useExpensesStore.setState({
      items: [{ id: 'e1', lifecycleState: 'active', trashedFromState: null } as never],
    });

    expect(() => restoreExpense('e1')).toThrow();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // Bug fix (see lifecycle-transitions.ts's restoreTransition comment) —
  // previously this threw for any merely-archived (never-trashed) record,
  // which is exactly the case the Archive screen's Restore button hits.
  it('restores a merely-archived (never trashed) record to active', async () => {
    useExpensesStore.setState({
      items: [{ id: 'e1', lifecycleState: 'archived', trashedFromState: null, archivedAt: null } as never],
    });

    await restoreExpense('e1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/e1',
      expect.objectContaining({ lifecycleState: 'active', trashedFromState: null, archivedAt: null }),
    );
  });

  // FR-21g (data-model.md §11, Stage 18) — a group archived/trashed
  // together comes back together.
  it('also restores active-group children still sitting in the same non-active lifecycleState', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', lifecycleState: 'archived', trashedFromState: null, archivedAt: null } as never,
        {
          id: 'netflix',
          kind: 'oneTime',
          parentExpenseId: 'card',
          lifecycleState: 'archived',
          trashedFromState: null,
          archivedAt: null,
        } as never,
        // Already restored independently before the parent was — should be
        // left alone, not touched a second time.
        { id: 'disney', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active' } as never,
      ],
    });

    await restoreExpense('card');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/card',
      expect.objectContaining({ lifecycleState: 'active' }),
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ lifecycleState: 'active' }),
    );
    expect(mockUpdateDoc).not.toHaveBeenCalledWith('users/test-uid/expenses/disney', expect.anything());
  });
});

describe('setExpensePaid group cascade (Stage 18, FR-21b)', () => {
  it('cascades marking the parent paid to every active child', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: false } as never,
        { id: 'disney', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: false } as never,
        // Archived child — must NOT be cascaded to (data-model.md §11).
        { id: 'old', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'archived', paid: false } as never,
      ],
    });

    await setExpensePaid('card', true);

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/card', expect.objectContaining({ paid: true }));
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/netflix', expect.objectContaining({ paid: true }));
    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/disney', expect.objectContaining({ paid: true }));
    expect(mockUpdateDoc).not.toHaveBeenCalledWith('users/test-uid/expenses/old', expect.anything());
  });

  it('cascades unmarking the parent to every active child', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: true } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: true } as never,
      ],
    });

    await setExpensePaid('card', false);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ paid: false, paidDate: null }),
    );
  });

  it('marks the parent paid only once every active child is paid', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: true } as never,
        { id: 'disney', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: false } as never,
      ],
    });

    await setExpensePaid('disney', true);

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/card', expect.objectContaining({ paid: true }));
  });

  it('unmarks an already-paid parent as soon as one active child is unmarked', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: true } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: true } as never,
        { id: 'disney', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: true } as never,
      ],
    });

    await setExpensePaid('netflix', false);

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/card', expect.objectContaining({ paid: false }));
  });

  it('does not touch the parent when the parent is already in the right state', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: false } as never,
        { id: 'disney', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: true } as never,
      ],
    });

    await setExpensePaid('netflix', false);

    expect(mockUpdateDoc).not.toHaveBeenCalledWith('users/test-uid/expenses/card', expect.anything());
  });
});

describe('setExpenseGroupParent (Stage 18, FR-21, FR-21a)', () => {
  it('assigns a parent', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
      ],
    });

    await setExpenseGroupParent('netflix', 'card');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ parentExpenseId: 'card' }),
    );
  });

  it('clears a parent', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: false } as never,
      ],
    });

    await setExpenseGroupParent('netflix', null);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ parentExpenseId: null }),
    );
  });

  it('throws when assigning an expense as its own parent', async () => {
    useExpensesStore.setState({
      items: [{ id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never],
    });

    await expect(setExpenseGroupParent('card', 'card')).rejects.toThrow();
  });

  it('throws when the chosen parent is itself already a child (single-level, FR-21a)', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active' } as never,
        { id: 'disney', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
      ],
    });

    await expect(setExpenseGroupParent('disney', 'netflix')).rejects.toThrow();
  });

  it('throws when the expense being grouped already has its own children (single-level, FR-21a)', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active' } as never,
        { id: 'otherCard', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
      ],
    });

    await expect(setExpenseGroupParent('card', 'otherCard')).rejects.toThrow();
  });

  it('recomputes the old parent when a paid child leaves its group', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: true } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active', paid: true } as never,
        { id: 'otherCard', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active', paid: false } as never,
      ],
    });

    // netflix was the only child, and card was fully paid because of it —
    // moving netflix elsewhere leaves card with zero children, so it
    // should no longer read as paid.
    await setExpenseGroupParent('netflix', 'otherCard');

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid/expenses/card', expect.objectContaining({ paid: false }));
  });
});

describe('archiveOrTrashExpenseGroup (Stage 18, FR-21e)', () => {
  it('cascade mode archives the parent and every active child', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active' } as never,
      ],
    });

    await archiveOrTrashExpenseGroup('card', 'archive', 'cascade');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/card',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
  });

  it('detach mode ungroups every child first, then archives only the parent', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active' } as never,
      ],
    });

    await archiveOrTrashExpenseGroup('card', 'archive', 'detach');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ parentExpenseId: null }),
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/card',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
    // Detach means the child itself is never transitioned to archived.
    expect(mockUpdateDoc).not.toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ lifecycleState: 'archived' }),
    );
  });

  it('cascade mode trashes every active child with the parent, reading trashRetentionDays', async () => {
    useExpensesStore.setState({
      items: [
        { id: 'card', kind: 'oneTime', parentExpenseId: null, lifecycleState: 'active' } as never,
        { id: 'netflix', kind: 'oneTime', parentExpenseId: 'card', lifecycleState: 'active' } as never,
      ],
    });

    await archiveOrTrashExpenseGroup('card', 'trash', 'cascade');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'users/test-uid/expenses/netflix',
      expect.objectContaining({ lifecycleState: 'trashed', trashedFromState: 'active' }),
    );
  });
});

describe('purgeExpense', () => {
  it('deletes the doc', async () => {
    await purgeExpense('e1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('users/test-uid/expenses/e1');
  });
});
