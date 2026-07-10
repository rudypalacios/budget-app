import { getApp } from '@react-native-firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from '@react-native-firebase/auth';

import type { AuthClient } from './auth.types';

const auth = getAuth(getApp());

export const authClient: AuthClient = {
  async ensureSignedIn() {
    if (auth.currentUser) return auth.currentUser.uid;
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  },

  onAuthStateChange(onNext) {
    return onAuthStateChanged(auth, (user) => onNext(user ? user.uid : null));
  },
};
