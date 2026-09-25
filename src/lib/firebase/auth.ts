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
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
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
    // GoogleSignin.signIn() silently reuses whichever Google account is
    // still cached as the native module's "current user" from a previous
    // sign-in, skipping the interactive account picker entirely once one
    // exists — confirmed live (multiple accounts on-device, chooser never
    // reappeared). signOut() here only clears that local cache (per this
    // library's docs, it does not revoke the underlying OAuth grant), so it
    // doesn't sign the user out of anything real — it just forces the
    // account picker to show every time, matching web's signInWithPopup,
    // which already lets the user pick an account on every attempt.
    await GoogleSignin.signOut();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return { status: 'cancelled' };

    // GoogleAuthProvider.credential(idToken) — with no second argument —
    // bridges the missing access token to the native module as an empty
    // string rather than a true null, and Android's native Firebase Auth
    // SDK rejects that with "Exception in HostFunction: accessToken cannot
    // be empty" (verified live). signIn()'s response never carries an
    // access token at all, only an idToken, so fetch the pair together via
    // getTokens() instead, which always returns non-empty strings for both.
    const { idToken, accessToken } = await GoogleSignin.getTokens();
    if (!idToken) throw new Error('Google sign-in did not return an ID token.');
    const credential = GoogleAuthProvider.credential(idToken, accessToken);

    try {
      // Same account-joining principle as signUpWithEmail above — see that
      // comment for why linkWithCredential (never a plain sign-in) is the
      // primary path.
      const result = await linkWithCredential(auth.currentUser!, credential);
      return { status: 'linked', user: toAuthUser(result.user) };
    } catch (error) {
      const code = getErrorCode(error);
      // This exact Google account is already linked to a different real
      // Firebase user (its own account-joining attempt happened before) —
      // fall back to signing into that existing account, abandoning the
      // current anonymous session (there's no form here to redirect
      // through, unlike use-auth-form.ts's sign-up-to-sign-in mode switch
      // on the same error).
      if (code === 'auth/credential-already-in-use') {
        const result = await signInWithCredential(auth, credential);
        return { status: 'linked', user: toAuthUser(result.user) };
      }
      // This Google account's *email* — not yet linked to Google at all —
      // already belongs to a different real account registered some other
      // way (e.g. email/password). Firebase enforces one account per
      // email, so linking can't complete here; the caller must have the
      // user sign in with their existing credential first, then finish via
      // completeGoogleLink. GoogleAuthProvider.credentialFromError always
      // returns null on React Native Firebase (unlike the web SDK), but
      // there's nothing to recover anyway — the credential built above
      // from the Google idToken is exactly what completeGoogleLink needs.
      // Mirrors auth.web.ts's same branch, which additionally checks
      // 'auth/account-exists-with-different-credential' — RNFirebase's
      // linkWithCredential can surface either code for this situation, so
      // both must map to the same conflict result here too.
      if (
        code === 'auth/email-already-in-use' ||
        code === 'auth/account-exists-with-different-credential'
      ) {
        return {
          status: 'account-exists',
          conflict: { email: response.data.user.email, pendingCredential: credential },
        };
      }
      throw error;
    }
  },

  async completeGoogleLink(pendingCredential) {
    const result = await linkWithCredential(
      auth.currentUser!,
      pendingCredential as ReturnType<typeof GoogleAuthProvider.credential>,
    );
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
