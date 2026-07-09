import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

import { app } from './app.web';
import type { AuthClient } from './auth.types';

const auth = getAuth(app);

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
