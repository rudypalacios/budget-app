import { create } from 'zustand';

import { authClient } from '@/lib/firebase/auth';
import { mapAuthErrorMessage } from '@/lib/firebase/auth-errors';

export type AuthStatus = 'pending' | 'ready' | 'error';

interface SessionState {
  uid: string | null;
  email: string | null;
  isAnonymous: boolean;
  status: AuthStatus;
}

export const useSessionStore = create<SessionState>(() => ({
  uid: null,
  email: null,
  isAnonymous: true,
  status: 'pending',
}));

function syncCurrentUser() {
  applyUser(authClient.getCurrentUser());
}

function applyUser(user: { uid: string; email: string | null; isAnonymous: boolean } | null) {
  useSessionStore.setState({
    uid: user?.uid ?? null,
    email: user?.email ?? null,
    isAnonymous: user?.isAnonymous ?? true,
  });
}

// Anonymous sign-in bridge (Stage 6), upgradeable in place via real
// email/password credentials (Stage 9a) without ever changing uid — see
// src/lib/firebase/auth.ts.
export async function bootstrapSession() {
  try {
    await authClient.ensureSignedIn();
    syncCurrentUser();
    useSessionStore.setState({ status: 'ready' });
  } catch {
    useSessionStore.setState({ uid: null, status: 'error' });
  }
}

let authStateSubscribed = false;

// Keeps the session store in sync with every subsequent auth-state change
// (sign-up, sign-in, sign-out), not just the initial bootstrap. Call once
// from _layout.tsx, matching createCollectionStore's subscribe() idiom —
// without this, the uid-reactive Firestore listeners there wouldn't
// re-subscribe to a different account's data after signing in/out.
export function subscribeAuthState() {
  if (authStateSubscribed) return;
  authStateSubscribed = true;
  authClient.onAuthStateChange(() => {
    syncCurrentUser();
  });
}

export type AuthActionResult = { ok: true } | { ok: false; code: string; message: string };

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return '';
}

// Applies the resolved user directly rather than waiting on
// authClient.onAuthStateChange: Firebase's auth-state listener fires on
// sign-in/sign-out (uid transitions) but doesn't reliably re-fire just
// because linkWithCredential flipped isAnonymous on the *same* uid — verified
// live, this left Settings showing "anonymous" indefinitely after a real
// sign-up. The listener stays subscribed as a backstop for changes that
// don't go through these actions (e.g. a future redirect-based sign-in).
export async function signUpWithEmail(email: string, password: string): Promise<AuthActionResult> {
  try {
    const user = await authClient.signUpWithEmail(email, password);
    applyUser(user);
    return { ok: true };
  } catch (error) {
    const code = getErrorCode(error);
    return { ok: false, code, message: mapAuthErrorMessage(code) };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthActionResult> {
  try {
    const user = await authClient.signInWithEmail(email, password);
    applyUser(user);
    return { ok: true };
  } catch (error) {
    const code = getErrorCode(error);
    return { ok: false, code, message: mapAuthErrorMessage(code) };
  }
}

export type GoogleSignInActionResult =
  | { ok: true }
  // The user backed out of the picker/popup — not a failure, but not a
  // navigable success either; callers should just no-op.
  | { ok: false; reason: 'cancelled' }
  // This Google account's email already belongs to a different real
  // account registered some other way — the caller must have the user
  // sign in with their existing credential (prefilled with `email`), then
  // call completeGoogleLink(pendingCredential) to finish joining the two.
  | { ok: false; reason: 'account-exists'; email: string | null; pendingCredential: unknown }
  // `reason` (not `code`) is the discriminant so this variant's plain
  // `string` code doesn't structurally overlap with the literal 'cancelled'/
  // 'account-exists' reasons above and break narrowing on it.
  | { ok: false; reason: 'error'; code: string; message: string };

// Same direct-apply-user reasoning as signUpWithEmail above — a Google-driven
// linkWithCredential also flips isAnonymous on the same uid, which the
// auth-state listener doesn't reliably re-fire for.
export async function signInWithGoogle(): Promise<GoogleSignInActionResult> {
  try {
    const result = await authClient.signInWithGoogle();
    if (result.status === 'cancelled') return { ok: false, reason: 'cancelled' };
    if (result.status === 'account-exists') {
      return {
        ok: false,
        reason: 'account-exists',
        email: result.conflict.email,
        pendingCredential: result.conflict.pendingCredential,
      };
    }
    applyUser(result.user);
    return { ok: true };
  } catch (error) {
    const code = getErrorCode(error);
    // Native Google Sign-In failures (e.g. Play Services issues, or a
    // misconfigured SHA-1/client ID) throw their own status codes, not
    // Firebase auth/-prefixed ones — mapAuthErrorMessage still surfaces the
    // raw code in its fallback message (see auth-errors.ts), but logging
    // the full error too means a device's Metro/logcat output has more to
    // go on than just what fits in that one line.
    console.error('signInWithGoogle failed:', error);
    return { ok: false, reason: 'error', code, message: mapAuthErrorMessage(code) };
  }
}

// Finishes joining a Google account flagged as an 'account-exists' conflict
// by a prior signInWithGoogle() call, once the user has proven ownership of
// that same account by signing in with their existing password — see
// login.tsx's handleGoogleSignIn/handleSubmit for the two-step flow this
// completes.
export async function completeGoogleLink(pendingCredential: unknown): Promise<AuthActionResult> {
  try {
    const user = await authClient.completeGoogleLink(pendingCredential);
    applyUser(user);
    return { ok: true };
  } catch (error) {
    const code = getErrorCode(error);
    return { ok: false, code, message: mapAuthErrorMessage(code) };
  }
}

// The app must never be left with no uid — every store assumes one exists —
// so signing out immediately restarts a fresh anonymous session.
export async function signOutAndRestartAnonymous(): Promise<void> {
  await authClient.signOut();
  await bootstrapSession();
}

// Always resolves ok, regardless of whether the email is actually
// registered — deliberately swallows failures (e.g. auth/user-not-found) so
// the UI can show one generic confirmation message without leaking account
// existence (email enumeration).
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  try {
    await authClient.sendPasswordReset(email);
  } catch {
    // See comment above — intentionally ignored.
  }
  return { ok: true };
}
