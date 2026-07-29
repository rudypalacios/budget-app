export type WhereFilterOp =
  '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';

export interface QueryConstraints {
  where?: [field: string, op: WhereFilterOp, value: unknown][];
  orderBy?: [field: string, direction?: 'asc' | 'desc'][];
  limit?: number;
}

export type Unsubscribe = () => void;

export type WithId<T> = T & { id: string };

// Surfaced alongside every listener callback so the sync-status indicator
// (FR-12a) can derive synced/pending/offline from real Firestore state
// instead of a separate network-detection dependency: `fromCache` covers the
// offline case, `hasPendingWrites` covers queued-but-unsynced local writes.
export interface SnapshotMeta {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export interface FirestoreClient {
  getDoc<T extends object>(path: string): Promise<WithId<T> | null>;
  // createdAt/updatedAt are stamped server-side by the implementation (never
  // by callers) so store/feature code never has to construct a Timestamp
  // itself, which would mean importing the platform Firestore SDK directly —
  // exactly what this shared interface exists to avoid.
  setDoc<T extends { createdAt: unknown; updatedAt: unknown }>(
    path: string,
    data: Omit<T, 'createdAt' | 'updatedAt'>,
  ): Promise<void>;
  addDoc<T extends { createdAt: unknown; updatedAt: unknown }>(
    collectionPath: string,
    data: Omit<T, 'createdAt' | 'updatedAt'>,
  ): Promise<string>;
  updateDoc(path: string, data: Record<string, unknown>): Promise<void>;
  // Applies every update atomically in one write — used where multiple
  // documents must change together (e.g. UserSettings.defaultCurrency
  // changing must also flip every recurringExpenses budgetRecommendation to
  // 'stale' in the same write, see docs/data-model.md §3).
  batchUpdate(updates: { path: string; data: Record<string, unknown> }[]): Promise<void>;
  deleteDoc(path: string): Promise<void>;
  getDocs<T extends object>(
    collectionPath: string,
    constraints?: QueryConstraints,
  ): Promise<WithId<T>[]>;
  subscribeDoc<T extends object>(
    path: string,
    onNext: (doc: WithId<T> | null, meta: SnapshotMeta) => void,
  ): Unsubscribe;
  subscribeCollection<T extends object>(
    collectionPath: string,
    onNext: (docs: WithId<T>[], meta: SnapshotMeta) => void,
    constraints?: QueryConstraints,
  ): Unsubscribe;
}
