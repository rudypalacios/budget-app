import { getApp } from '@react-native-firebase/app';
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
} from '@react-native-firebase/auth';

import type { AuthClient, AuthUser } from './auth.types';

const auth = getAuth(getApp());

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous };
}

export const authClient: AuthClient = {
  async ensureSignedIn() {
    // Mirrors auth.web.ts's fix for the same restoration race — wait for the
    // persisted session to load before deciding whether to sign in
    // anonymously (see that file's comment for the web repro).
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
