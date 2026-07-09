export type WhereFilterOp =
  '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';

export interface QueryConstraints {
  where?: [field: string, op: WhereFilterOp, value: unknown][];
  orderBy?: [field: string, direction?: 'asc' | 'desc'][];
  limit?: number;
}

export type Unsubscribe = () => void;

export type WithId<T> = T & { id: string };

export interface FirestoreClient {
  getDoc<T extends object>(path: string): Promise<WithId<T> | null>;
  setDoc<T extends object>(path: string, data: T): Promise<void>;
  updateDoc(path: string, data: Record<string, unknown>): Promise<void>;
  deleteDoc(path: string): Promise<void>;
  getDocs<T extends object>(
    collectionPath: string,
    constraints?: QueryConstraints,
  ): Promise<WithId<T>[]>;
  subscribeDoc<T extends object>(
    path: string,
    onNext: (doc: WithId<T> | null) => void,
  ): Unsubscribe;
  subscribeCollection<T extends object>(
    collectionPath: string,
    onNext: (docs: WithId<T>[]) => void,
    constraints?: QueryConstraints,
  ): Unsubscribe;
}
