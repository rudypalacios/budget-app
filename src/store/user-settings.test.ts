// Mocks first (must precede the imports below — see session.test.ts for the
// same idiom). Mocking at the firestoreClient/store boundaries rather than
// the underlying Firebase SDKs keeps this test isolated from session.ts's
// real auth-SDK dependencies (which session.test.ts already covers) — this
// file only cares about the uid value, not auth behavior.
/* eslint-disable import/first */
const mockSubscribeDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockBatchUpdate = jest.fn();

jest.mock('@/lib/firebase/firestore', () => ({
  firestoreClient: {
    subscribeDoc: (...args: unknown[]) => mockSubscribeDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    batchUpdate: (...args: unknown[]) => mockBatchUpdate(...args),
    getDoc: jest.fn(),
    addDoc: jest.fn(),
    deleteDoc: jest.fn(),
    getDocs: jest.fn(),
    subscribeCollection: jest.fn(),
  },
}));

jest.mock('@/store/session', () => ({
  useSessionStore: { getState: () => ({ uid: 'test-uid' }) },
}));

let mockRecurringExpenseItems: { id: string }[] = [];
jest.mock('@/store/recurring-expenses', () => ({
  useRecurringExpensesStore: { getState: () => ({ items: mockRecurringExpenseItems }) },
}));

let mockCurrencyItems: { id: string }[] = [];
jest.mock('@/store/currencies', () => ({
  useCurrenciesStore: { getState: () => ({ items: mockCurrencyItems }) },
}));

import {
  seedDefaultUserSettings,
  subscribeUserSettings,
  updateUserSettings,
  useUserSettingsStore,
} from './user-settings';
/* eslint-enable import/first */

type SubscribeDocCallback = (doc: unknown, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void;

// createDocumentStore's subscribe() no-ops on a repeat call for the same uid
// (see create-document-store.ts), so — mirroring how _layout.tsx only calls
// it once per real uid — this test file subscribes exactly once here, up
// front, and reuses the captured listener callback across every test below
// rather than re-subscribing per test.
let capturedOnNext: SubscribeDocCallback;

beforeAll(() => {
  mockSubscribeDoc.mockImplementation((_path: string, onNext: SubscribeDocCallback) => {
    capturedOnNext = onNext;
    return () => {};
  });
  subscribeUserSettings('test-uid');
});

function emitSnapshot(doc: unknown) {
  capturedOnNext(doc, { fromCache: false, hasPendingWrites: false });
}

beforeEach(() => {
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockBatchUpdate.mockClear();
  mockRecurringExpenseItems = [];
  mockCurrencyItems = [];
  useUserSettingsStore.setState({ data: null, isLoading: true, error: null, fromCache: false, hasPendingWrites: false });
});

describe('seedDefaultUserSettings', () => {
  it('writes the default document with the detected language', async () => {
    await seedDefaultUserSettings('es');

    expect(mockSetDoc).toHaveBeenCalledWith('users/test-uid', {
      defaultCurrency: 'GTQ',
      language: 'es',
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
  });
});

describe('updateUserSettings', () => {
  it('persists the patch without touching recurring expenses when defaultCurrency is unchanged', async () => {
    emitSnapshot({
      id: 'test-uid',
      defaultCurrency: 'GTQ',
      language: 'en',
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
    mockRecurringExpenseItems = [{ id: 'r1' }, { id: 'r2' }];

    await updateUserSettings({ language: 'es' });

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid', { language: 'es' });
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('batch-marks every recurring expense as stale when defaultCurrency changes (docs/data-model.md §3)', async () => {
    emitSnapshot({
      id: 'test-uid',
      defaultCurrency: 'GTQ',
      language: 'en',
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
    mockRecurringExpenseItems = [{ id: 'r1' }, { id: 'r2' }];

    await updateUserSettings({ defaultCurrency: 'USD' });

    expect(mockUpdateDoc).toHaveBeenCalledWith('users/test-uid', { defaultCurrency: 'USD' });
    expect(mockBatchUpdate).toHaveBeenCalledWith([
      { path: 'users/test-uid/recurringExpenses/r1', data: { 'budgetRecommendation.status': 'stale' } },
      { path: 'users/test-uid/recurringExpenses/r2', data: { 'budgetRecommendation.status': 'stale' } },
    ]);
  });

  it('does not batch-update when there are no recurring expenses to mark', async () => {
    emitSnapshot({
      id: 'test-uid',
      defaultCurrency: 'GTQ',
      language: 'en',
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
    mockRecurringExpenseItems = [];

    await updateUserSettings({ defaultCurrency: 'USD' });

    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it('batch-marks every added currency as stale when defaultCurrency changes (docs/data-model.md §3a)', async () => {
    emitSnapshot({
      id: 'test-uid',
      defaultCurrency: 'GTQ',
      language: 'en',
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
    mockCurrencyItems = [{ id: 'EUR' }, { id: 'USD' }];

    await updateUserSettings({ defaultCurrency: 'MXN' });

    expect(mockBatchUpdate).toHaveBeenCalledWith([
      { path: 'users/test-uid/currencies/EUR', data: { status: 'stale' } },
      { path: 'users/test-uid/currencies/USD', data: { status: 'stale' } },
    ]);
  });

  it('does not batch-update currencies when there are none added', async () => {
    emitSnapshot({
      id: 'test-uid',
      defaultCurrency: 'GTQ',
      language: 'en',
      theme: 'system',
      trashRetentionDays: 30,
      reminders: { enabled: true, leadDays: 1, timeOfDay: null },
    });
    mockCurrencyItems = [];

    await updateUserSettings({ defaultCurrency: 'USD' });

    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });
});
