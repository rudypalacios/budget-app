import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type AuthCredential,
  type AuthError,
  type User,
} from 'firebase/auth';

import { app } from './app.web';
import type { AuthClient, AuthUser } from './auth.types';

const auth = getAuth(app);

// Closing the popup without finishing, or a repeat click while one is still
// open — treated the same as native's non-throwing cancellation, not an error.
const GOOGLE_POPUP_CANCELLED_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
]);

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous };
}

function getErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

export const authClient: AuthClient = {
  async ensureSignedIn() {
    // Firebase's web SDK restores a persisted session (IndexedDB)
    // asynchronously — auth.currentUser is still null immediately after
    // getAuth() on a fresh page load, even for an already-signed-in account.
    // Without this wait, a page reload would race ahead and sign in a brand
    // new anonymous session before the real one had a chance to restore
    // (verified live: reloading after sign-up silently reverted to a fresh
    // anonymous account instead of the signed-in one).
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser.uid;
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  },

  onAuthStateChange(onNext) {
    return onAuthStateChanged(auth, (user) => onNext(user ? user.uid : null));
  },

  async signUpWithEmail(email, password) {
    const credential = EmailAuthProvider.credential(email, password);
    // linkWithCredential upgrades the current anonymous uid in place —
    // never use createUserWithEmailAndPassword here, it would mint a new
    // uid and orphan the existing anonymous session's Firestore documents.
    const result = await linkWithCredential(auth.currentUser!, credential);
    return toAuthUser(result.user);
  },

  async signInWithEmail(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return toAuthUser(result.user);
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      // Same account-joining principle as signUpWithEmail above — see that
      // comment for why linkWithPopup (never a plain sign-in) is the
      // primary path.
      const result = await linkWithPopup(auth.currentUser!, provider);
      return { status: 'linked', user: toAuthUser(result.user) };
    } catch (error) {
      const code = getErrorCode(error);
      if (GOOGLE_POPUP_CANCELLED_CODES.has(code)) return { status: 'cancelled' };
      // This exact Google account is already linked to a different real
      // Firebase user (its own account-joining attempt happened before) —
      // fall back to signing into that existing account, abandoning the
      // current anonymous session (there's no form here to redirect
      // through, unlike use-auth-form.ts's sign-up-to-sign-in mode switch
      // on the same error). Deliberately NOT a second signInWithPopup call
      // here — opening another popup from this async continuation gets
      // blocked by the browser (verified live: Chrome throws
      // auth/popup-blocked, since this no longer reads as a direct result
      // of the user's click). Firebase already attaches the completed
      // OAuth exchange from the *first* popup to this error's customData
      // (same mechanism as the email-already-in-use case below), so
      // there's nothing left to prompt for — just sign in with it.
      if (code === 'auth/credential-already-in-use') {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error as AuthError);
        if (!pendingCredential) throw error;
        const result = await signInWithCredential(auth, pendingCredential);
        return { status: 'linked', user: toAuthUser(result.user) };
      }
      // This Google account's *email* — not yet linked to Google at all —
      // already belongs to a different real account registered some other
      // way (e.g. email/password). Firebase enforces one account per
      // email, so linking can't complete here; the caller must have the
      // user sign in with their existing credential first, then finish via
      // completeGoogleLink. Firebase attaches enough of the popup's OAuth
      // exchange to this error's customData for credentialFromError to
      // reconstruct it, even though it couldn't be linked yet.
      if (
        code === 'auth/email-already-in-use' ||
        code === 'auth/account-exists-with-different-credential'
      ) {
        const authError = error as AuthError;
        const pendingCredential = GoogleAuthProvider.credentialFromError(authError);
        return {
          status: 'account-exists',
          conflict: { email: authError.customData?.email ?? null, pendingCredential },
        };
      }
      throw error;
    }
  },

  async completeGoogleLink(pendingCredential) {
    const result = await linkWithCredential(auth.currentUser!, pendingCredential as AuthCredential);
    return toAuthUser(result.user);
  },

  async signOut() {
    await firebaseSignOut(auth);
  },

  async sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
  },

  getCurrentUser() {
    return auth.currentUser ? toAuthUser(auth.currentUser) : null;
  },
};
