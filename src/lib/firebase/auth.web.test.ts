// Jest resolves the platform-agnostic './auth' import to auth.ts (native) by
// default (see session.test.ts's comment on the same topic), so auth.web.ts
// gets no coverage unless imported directly by its literal filename, as
// done below. Mocking the underlying firebase/auth SDK (rather than this
// file's own exports) lets the real authClient implementation run against
// these fakes, the same idiom session.test.ts uses for the native SDK.
/* eslint-disable import/first */
const fakeAuth: {
  currentUser: { uid: string; email: string | null; isAnonymous: boolean } | null;
  authStateReady: () => Promise<void>;
} = {
  currentUser: null,
  authStateReady: () => Promise.resolve(),
};

const mockLinkWithPopup = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockCredentialFromError = jest.fn();

jest.mock('firebase/app', () => ({
  getApps: jest.fn(() => [{}]),
  getApp: jest.fn(() => ({})),
  initializeApp: jest.fn(() => ({})),
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => fakeAuth),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  EmailAuthProvider: { credential: jest.fn((email, password) => ({ email, password })) },
  GoogleAuthProvider: class {
    static credentialFromError(...args: unknown[]) {
      return mockCredentialFromError(...args);
    }
  },
  linkWithPopup: (...args: unknown[]) => mockLinkWithPopup(...args),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(),
}));

import { authClient } from './auth.web';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.currentUser = { uid: 'anon-uid', email: null, isAnonymous: true };
});

describe('signInWithGoogle', () => {
  it('links the popup credential to the existing anonymous uid on success', async () => {
    mockLinkWithPopup.mockResolvedValue({ user: { uid: 'anon-uid', email: 'a@b.com', isAnonymous: false } });

    await expect(authClient.signInWithGoogle()).resolves.toEqual({
      status: 'linked',
      user: { uid: 'anon-uid', email: 'a@b.com', isAnonymous: false },
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('returns cancelled without reopening a popup when the user closes it', async () => {
    mockLinkWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    await expect(authClient.signInWithGoogle()).resolves.toEqual({ status: 'cancelled' });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('signs in with the credential recovered from the error, without opening a second popup, when this Google account is already linked to a different real user', async () => {
    // Regression test: opening a second signInWithPopup here (the original
    // implementation) gets blocked by the browser, since by the time this
    // async continuation runs it no longer reads as a direct result of the
    // user's click — reproduced live as auth/popup-blocked. Firebase
    // attaches the completed OAuth exchange from the first popup to the
    // error's customData, which is what credentialFromError recovers here
    // instead of prompting again.
    const recoveredCredential = { idToken: 'recovered-token' };
    mockLinkWithPopup.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    mockCredentialFromError.mockReturnValue(recoveredCredential);
    mockSignInWithCredential.mockResolvedValue({
      user: { uid: 'other-real-uid', email: 'a@b.com', isAnonymous: false },
    });

    await expect(authClient.signInWithGoogle()).resolves.toEqual({
      status: 'linked',
      user: { uid: 'other-real-uid', email: 'a@b.com', isAnonymous: false },
    });
    expect(mockSignInWithCredential).toHaveBeenCalledWith(fakeAuth, recoveredCredential);
  });

  it('reports an account-exists conflict when the email already belongs to a different real account', async () => {
    const recoveredCredential = { idToken: 'recovered-token' };
    mockLinkWithPopup.mockRejectedValue({ code: 'auth/email-already-in-use', customData: { email: 'a@b.com' } });
    mockCredentialFromError.mockReturnValue(recoveredCredential);

    await expect(authClient.signInWithGoogle()).resolves.toEqual({
      status: 'account-exists',
      conflict: { email: 'a@b.com', pendingCredential: recoveredCredential },
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('rethrows an unrecognized error', async () => {
    mockLinkWithPopup.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(authClient.signInWithGoogle()).rejects.toEqual({ code: 'auth/network-request-failed' });
  });
});

describe('completeGoogleLink', () => {
  it('links the pending credential to the currently signed-in user', async () => {
    fakeAuth.currentUser = { uid: 'real-uid', email: 'a@b.com', isAnonymous: false };
    mockLinkWithCredential.mockResolvedValue({ user: { uid: 'real-uid', email: 'a@b.com', isAnonymous: false } });

    const pendingCredential = { idToken: 'recovered-token' };
    await expect(authClient.completeGoogleLink(pendingCredential)).resolves.toEqual({
      uid: 'real-uid',
      email: 'a@b.com',
      isAnonymous: false,
    });
    expect(mockLinkWithCredential).toHaveBeenCalledWith(fakeAuth.currentUser, pendingCredential);
  });
});
