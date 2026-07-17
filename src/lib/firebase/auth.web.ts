import {
  EmailAuthProvider,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';

import { app } from './app.web';
import type { AuthClient, AuthUser } from './auth.types';

const auth = getAuth(app);

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous };
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
