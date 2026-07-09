import { create } from 'zustand';

import { authClient } from '@/lib/firebase/auth';

export type AuthStatus = 'pending' | 'ready' | 'error';

interface SessionState {
  uid: string | null;
  status: AuthStatus;
}

export const useSessionStore = create<SessionState>(() => ({
  uid: null,
  status: 'pending',
}));

// Anonymous sign-in bridge (Stage 6) until real Firebase Auth lands in
// Stage 8 — see docs/SRS-presupuesto-app.md §11. Firebase persists the
// anonymous session locally, so a returning user keeps the same uid across
// launches rather than getting a fresh one each time.
export async function bootstrapSession() {
  try {
    const uid = await authClient.ensureSignedIn();
    useSessionStore.setState({ uid, status: 'ready' });
  } catch {
    useSessionStore.setState({ uid: null, status: 'error' });
  }
}
