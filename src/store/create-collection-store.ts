import { create } from 'zustand';

import { firestoreClient } from '@/lib/firebase/firestore';
import type { Unsubscribe, WithId } from '@/lib/firebase/firestore.types';

interface CollectionState<T extends object> {
  items: WithId<T>[];
  isLoading: boolean;
  error: Error | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
}

function initialState<T extends object>(): CollectionState<T> {
  return { items: [], isLoading: true, error: null, fromCache: false, hasPendingWrites: false };
}

// One store per users/{uid}/{collectionName} collection (see CLAUDE.md's
// /store convention) — mirrors the one-per-type shape create-mock-store.tsx
// used, now backed by real Firestore listeners instead of local state.
//
// Scoped to read + create + edit-in-place only. Archive/Trash/restore/purge
// (FR-4a-4e) is Stage 11's job and isn't wired here.
export function createCollectionStore<T extends { createdAt: unknown; updatedAt: unknown }>(
  collectionName: string,
) {
  const useStore = create<CollectionState<T>>(() => initialState<T>());

  let unsubscribe: Unsubscribe | null = null;
  let currentUid: string | null = null;

  function path(uid: string) {
    return `users/${uid}/${collectionName}`;
  }

  // Call once per signed-in uid (from _layout.tsx's bootstrap), not per
  // screen — re-subscribing on every mount would multiply listeners.
  function subscribe(uid: string) {
    if (currentUid === uid) return;
    unsubscribe?.();
    currentUid = uid;
    useStore.setState(initialState<T>());
    unsubscribe = firestoreClient.subscribeCollection<T>(path(uid), (docs, meta) => {
      useStore.setState({
        items: docs,
        isLoading: false,
        error: null,
        fromCache: meta.fromCache,
        hasPendingWrites: meta.hasPendingWrites,
      });
    });
  }

  async function add(data: Omit<T, 'createdAt' | 'updatedAt'>) {
    if (!currentUid) throw new Error(`${collectionName} store: add() called before subscribe()`);
    return firestoreClient.addDoc<T>(path(currentUid), data);
  }

  async function update(id: string, patch: Partial<Omit<T, 'createdAt' | 'updatedAt'>>) {
    if (!currentUid) {
      throw new Error(`${collectionName} store: update() called before subscribe()`);
    }
    await firestoreClient.updateDoc(`${path(currentUid)}/${id}`, patch);
  }

  // Deterministic-ID write, distinct from add()'s auto-ID path — used by
  // recurring-instance generation (Stage 6b), which must write to
  // `{recurringExpenseId}_{yyyy-MM}`-shaped IDs so two devices generating the
  // same period both converge on the same document (data-model.md §6/§9).
  async function setAt(id: string, data: Omit<T, 'createdAt' | 'updatedAt'>) {
    if (!currentUid) throw new Error(`${collectionName} store: setAt() called before subscribe()`);
    await firestoreClient.setDoc<T>(`${path(currentUid)}/${id}`, data);
  }

  return { useStore, subscribe, add, update, setAt };
}
