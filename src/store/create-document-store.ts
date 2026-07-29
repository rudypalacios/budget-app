import { create } from 'zustand';

import { firestoreClient } from '@/lib/firebase/firestore';
import type { Unsubscribe, WithId } from '@/lib/firebase/firestore.types';

interface DocumentState<T extends object> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: Error | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
}

function initialState<T extends object>(): DocumentState<T> {
  return { data: null, isLoading: true, error: null, fromCache: false, hasPendingWrites: false };
}

// Single-document counterpart to createCollectionStore (see that file for
// the collection version) — for the one users/{uid} doc itself, not a
// users/{uid}/{collectionName} subcollection.
export function createDocumentStore<T extends { createdAt: unknown; updatedAt: unknown }>() {
  const useStore = create<DocumentState<T>>(() => initialState<T>());

  let unsubscribe: Unsubscribe | null = null;
  let currentUid: string | null = null;

  function path(uid: string) {
    return `users/${uid}`;
  }

  // Call once per signed-in uid (from _layout.tsx's bootstrap), not per
  // screen — mirrors createCollectionStore's subscribe() idiom.
  function subscribe(uid: string) {
    if (currentUid === uid) return;
    unsubscribe?.();
    currentUid = uid;
    useStore.setState(initialState<T>());
    unsubscribe = firestoreClient.subscribeDoc<T>(path(uid), (doc, meta) => {
      useStore.setState({
        data: doc,
        isLoading: false,
        error: null,
        fromCache: meta.fromCache,
        hasPendingWrites: meta.hasPendingWrites,
      });
    });
  }

  async function set(data: Omit<T, 'createdAt' | 'updatedAt'>) {
    if (!currentUid) throw new Error('document store: set() called before subscribe()');
    await firestoreClient.setDoc<T>(path(currentUid), data);
  }

  async function update(patch: Partial<Omit<T, 'createdAt' | 'updatedAt'>>) {
    if (!currentUid) throw new Error('document store: update() called before subscribe()');
    await firestoreClient.updateDoc(path(currentUid), patch);
  }

  return { useStore, subscribe, set, update, path };
}
