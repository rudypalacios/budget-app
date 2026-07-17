import {
  addDoc as fsAddDoc,
  collection,
  deleteDoc as fsDeleteDoc,
  doc,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  initializeFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy as fsOrderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  where as fsWhere,
  type QueryConstraint,
} from 'firebase/firestore';

import { app } from './app.web';
import type { FirestoreClient, QueryConstraints, SnapshotMeta, WithId } from './firestore.types';

// Multi-tab manager: a user could have the web app open in more than one browser tab.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

function toConstraints(constraints?: QueryConstraints): QueryConstraint[] {
  const result: QueryConstraint[] = [];
  for (const [field, op, value] of constraints?.where ?? []) {
    result.push(fsWhere(field, op, value));
  }
  for (const [field, direction] of constraints?.orderBy ?? []) {
    result.push(fsOrderBy(field, direction));
  }
  if (constraints?.limit != null) {
    result.push(fsLimit(constraints.limit));
  }
  return result;
}

export const firestoreClient: FirestoreClient = {
  async getDoc<T extends object>(path: string) {
    const snap = await fsGetDoc(doc(db, path));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null;
  },

  async setDoc<T extends { createdAt: unknown; updatedAt: unknown }>(
    path: string,
    data: Omit<T, 'createdAt' | 'updatedAt'>,
  ) {
    await fsSetDoc(doc(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },

  async addDoc<T extends { createdAt: unknown; updatedAt: unknown }>(
    collectionPath: string,
    data: Omit<T, 'createdAt' | 'updatedAt'>,
  ) {
    const ref = await fsAddDoc(collection(db, collectionPath), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async updateDoc(path: string, data: Record<string, unknown>) {
    await fsUpdateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
  },

  async deleteDoc(path: string) {
    await fsDeleteDoc(doc(db, path));
  },

  async getDocs<T extends object>(collectionPath: string, constraints?: QueryConstraints) {
    const snap = await fsGetDocs(
      query(collection(db, collectionPath), ...toConstraints(constraints)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithId<T>);
  },

  subscribeDoc<T extends object>(
    path: string,
    onNext: (doc: WithId<T> | null, meta: SnapshotMeta) => void,
  ) {
    return onSnapshot(
      doc(db, path),
      { includeMetadataChanges: true },
      (snap) => {
        onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null, {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });
      },
      // Without this, an error (e.g. permission-denied from a stale listener
      // still attached to a just-signed-out uid — see signOutAndRestartAnonymous
      // in session.ts) falls through to the Firestore SDK's own default
      // "Uncaught Error in snapshot listener" console logging instead of ours.
      // Logging and returning here leaves the store's last-known state as-is
      // rather than clearing it, since this listener is effectively done
      // either way — a legitimate subscribe() call for whichever uid is
      // current will tear it down and replace it shortly after.
      (error) => {
        console.warn(`[firestore] subscribeDoc(${path}) listener error:`, error);
      },
    );
  },

  subscribeCollection<T extends object>(
    collectionPath: string,
    onNext: (docs: WithId<T>[], meta: SnapshotMeta) => void,
    constraints?: QueryConstraints,
  ) {
    return onSnapshot(
      query(collection(db, collectionPath), ...toConstraints(constraints)),
      { includeMetadataChanges: true },
      (snap) => {
        onNext(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithId<T>),
          { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites },
        );
      },
      // See subscribeDoc's onError comment above — same reasoning.
      (error) => {
        console.warn(`[firestore] subscribeCollection(${collectionPath}) listener error:`, error);
      },
    );
  },
};
