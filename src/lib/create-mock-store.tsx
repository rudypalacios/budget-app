import { createContext, useContext, useState, type ReactNode } from 'react';

// TEMP-for-Stage-5 — a tiny in-memory Context store so the add/edit modal
// routes and their list screen can share state without real persistence.
// This is NOT a preview of Stage 6's Zustand state layer (see CLAUDE.md's
// /store folder convention, reserved for that) — it exists only so this
// stage's mock data survives navigating to a separate route, and gets
// replaced outright when Stage 6 wires real Firestore-backed state.
export function createMockStore<T extends { id: string }>(seed: T[]) {
  type StoreValue = {
    items: T[];
    addItem: (item: T) => void;
    updateItem: (id: string, patch: Partial<T>) => void;
  };

  const Context = createContext<StoreValue | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<T[]>(seed);

    function addItem(item: T) {
      setItems((current) => [item, ...current]);
    }

    function updateItem(id: string, patch: Partial<T>) {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }

    return <Context.Provider value={{ items, addItem, updateItem }}>{children}</Context.Provider>;
  }

  function useStore() {
    const value = useContext(Context);
    if (!value) throw new Error('useStore must be used within its matching Provider');
    return value;
  }

  return { Provider, useStore };
}
