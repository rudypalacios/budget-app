import { act, renderHook } from '@testing-library/react-native';

import NetInfo from '@react-native-community/netinfo';

import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';
import { useSyncStatus } from './use-sync-status';

// Stage 7 (FR-12a multi-collection correctness) — importing the real
// collection-store modules pulls in src/lib/firebase/firestore.ts, which
// eagerly calls getFirestore(getApp())/getAuth(getApp()) at module load.
// These stubs satisfy that import chain only; subscribe() is never called
// in this test, so none of these functions actually run. jest.mock() calls
// are hoisted above the imports above by babel-plugin-jest-hoist regardless
// of source order, so this placement is just for readability.
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  getFirestore: jest.fn(() => ({})),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
  signInAnonymously: jest.fn(),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));

// useNetworkStatus (native) reads real device connectivity via NetInfo —
// this mock is self-contained (no outer-scope references, per
// babel-plugin-jest-hoist's rules for jest.mock factories) and exposes a
// test-only escape hatch to simulate connectivity changes.
jest.mock('@react-native-community/netinfo', () => {
  let listener: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | null = null;
  return {
    addEventListener: (cb: (state: { isConnected: boolean; isInternetReachable: boolean }) => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    __triggerNetworkChange: (state: { isConnected: boolean; isInternetReachable: boolean }) => {
      listener?.(state);
    },
  };
});

type MockNetInfo = { __triggerNetworkChange: (state: { isConnected: boolean; isInternetReachable: boolean }) => void };

function setOnline(isConnected: boolean) {
  act(() => {
    (NetInfo as unknown as MockNetInfo).__triggerNetworkChange({ isConnected, isInternetReachable: isConnected });
  });
}

// Baseline: every collection fully loaded, synced, online, auth ready —
// each test then overrides exactly the field(s) it's exercising. Each
// store's setState has its own generic CollectionState<T>, so these can't
// be collapsed into a loop over a shared-type array.
function resetToFullySynced() {
  const synced = { items: [], isLoading: false, error: null, fromCache: false, hasPendingWrites: false };
  useCategoriesStore.setState(synced);
  useExpensesStore.setState(synced);
  useIncomesStore.setState(synced);
  useRecurringExpensesStore.setState(synced);
  useRecurringIncomesStore.setState(synced);
  useSessionStore.setState({ uid: 'test-uid', status: 'ready' });
}

beforeEach(() => {
  resetToFullySynced();
});

test('reports synced when every collection is loaded, synced, and online', () => {
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current).toBe('synced');
});

test('reports pending when exactly one collection is still loading', () => {
  useRecurringIncomesStore.setState({ isLoading: true });
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current).toBe('pending');
});

test('reports pending when exactly one collection has a pending write, even though the other four are fully synced', () => {
  // This is the core multi-collection assertion (FR-12a): a single
  // collection's unflushed write must not be masked by the other four
  // already being synced.
  useExpensesStore.setState({ hasPendingWrites: true });
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current).toBe('pending');
});

test('reports offline when disconnected and at least one collection is reading from cache', () => {
  useCategoriesStore.setState({ fromCache: true });
  const { result } = renderHook(() => useSyncStatus());
  setOnline(false);
  expect(result.current).toBe('offline');
});

test('does not report offline from fromCache alone while still online (cold-start false positive guard)', () => {
  useIncomesStore.setState({ fromCache: true });
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current).toBe('synced');
});

test('reports pending when the auth session is not ready yet, regardless of collection state', () => {
  useSessionStore.setState({ uid: null, status: 'pending' });
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current).toBe('pending');
});
