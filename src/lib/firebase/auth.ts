import { getApp } from '@react-native-firebase/app';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import type { AuthClient, AuthUser } from './auth.types';

const auth = getAuth(getApp());

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous };
}

function getErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
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

  async signInWithGoogle() {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;

    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google sign-in did not return an ID token.');
    const credential = GoogleAuthProvider.credential(idToken);

    try {
      // Same account-joining principle as signUpWithEmail above — see that
      // comment for why linkWithCredential (never a plain sign-in) is the
      // primary path.
      const result = await linkWithCredential(auth.currentUser!, credential);
      return toAuthUser(result.user);
    } catch (error) {
      // This Google account is already a real, separate Firebase user —
      // linking can't succeed. Fall back to signing into that existing
      // account, abandoning the current anonymous session (there's no
      // form here to redirect through, unlike use-auth-form.ts's
      // sign-up-to-sign-in mode switch on the same error).
      if (getErrorCode(error) === 'auth/credential-already-in-use') {
        const result = await signInWithCredential(auth, credential);
        return toAuthUser(result.user);
      }
      throw error;
    }
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
