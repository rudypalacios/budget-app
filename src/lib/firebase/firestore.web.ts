import { getApp, getApps, initializeApp } from 'firebase/app';
import {
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
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  where as fsWhere,
  type QueryConstraint,
} from 'firebase/firestore';

import type { FirestoreClient, QueryConstraints, WithId } from './firestore.types';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// getApps() guard avoids "app already exists" on Metro Fast Refresh / re-evaluation.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

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
