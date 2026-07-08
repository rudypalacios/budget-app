import { getApp } from '@react-native-firebase/app';
import {
  collection,
  deleteDoc as fsDeleteDoc,
  doc,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  getFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy as fsOrderBy,
  query,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  where as fsWhere,
  type QueryConstraint,
} from '@react-native-firebase/firestore';

import type { FirestoreClient, QueryConstraints, WithId } from './firestore.types';

// Offline persistence is on by default in the native SDKs RNFirebase wraps —
// unlike the web JS SDK, no explicit local-cache configuration is needed.
const db = getFirestore(getApp());

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

  async setDoc<T extends object>(path: string, data: T) {
    await fsSetDoc(doc(db, path), data);
  },

  async updateDoc(path: string, data: Record<string, unknown>) {
    await fsUpdateDoc(doc(db, path), data);
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

  subscribeDoc<T extends object>(path: string, onNext: (doc: WithId<T> | null) => void) {
    return onSnapshot(doc(db, path), (snap) => {
      onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null);
    });
  },

  subscribeCollection<T extends object>(
    collectionPath: string,
    onNext: (docs: WithId<T>[]) => void,
    constraints?: QueryConstraints,
  ) {
    return onSnapshot(
      query(collection(db, collectionPath), ...toConstraints(constraints)),
      (snap) => {
        onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithId<T>));
      },
    );
  },
};
