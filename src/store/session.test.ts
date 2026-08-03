// Mocking '@/lib/firebase/auth' directly (rather than the SDK it wraps)
// doesn't reliably apply when this test file only reaches it transitively
// through './session' (verified directly — unlike a same-file mock of the
// same path, which does work). Mocking the underlying
// @react-native-firebase/auth SDK instead — the same idiom
// src/hooks/use-sync-status.test.ts uses — sidesteps that and lets the real
// auth.ts implementation run against these fakes, so these tests also cover
// the linkWithCredential-vs-signInWithEmailAndPassword branch choice.
/* eslint-disable import/first */
const fakeAuth: {
  currentUser: { uid: string; email: string | null; isAnonymous: boolean } | null;
  authStateReady: () => Promise<void>;
} = {
  currentUser: null,
  authStateReady: () => Promise.resolve(),
};

const mockLinkWithCredential = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockSignOut = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockGetTokens = jest.fn();

jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({})) }));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => fakeAuth),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  EmailAuthProvider: { credential: jest.fn((email, password) => ({ email, password })) },
  GoogleAuthProvider: { credential: jest.fn((idToken, accessToken) => ({ idToken, accessToken })) },
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    // Called at the top of signInWithGoogle to clear the native module's
    // cached account so the picker reappears every time — see auth.ts.
    signOut: jest.fn(() => Promise.resolve(null)),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
  },
}));

import {
  completeGoogleLink,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutAndRestartAnonymous,
  signUpWithEmail,
  useSessionStore,
} from './session';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.currentUser = { uid: 'anon-uid', email: null, isAnonymous: true };
  useSessionStore.setState({ uid: null, email: null, isAnonymous: true, status: 'pending' });
});

describe('signUpWithEmail', () => {
  it('links the credential to the existing anonymous uid on success', async () => {
    mockLinkWithCredential.mockResolvedValue({
      user: { uid: 'anon-uid', email: 'a@b.com', isAnonymous: false },
    });

    await expect(signUpWithEmail('a@b.com', 'password123')).resolves.toEqual({ ok: true });
    expect(mockLinkWithCredential).toHaveBeenCalledWith(fakeAuth.currentUser, { email: 'a@b.com', password: 'password123' });
    expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('maps a thrown Firebase error to a user-facing message and preserves the code', async () => {
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/email-already-in-use' });
    await expect(signUpWithEmail('a@b.com', 'password123')).resolves.toEqual({
      ok: false,
      code: 'auth/email-already-in-use',
      message: 'An account with this email already exists.',
    });
  });
});

describe('signInWithEmail', () => {
  it('signs in directly (never linking) on success', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'real-uid', email: 'a@b.com', isAnonymous: false },
    });

    await expect(signInWithEmail('a@b.com', 'password123')).resolves.toEqual({ ok: true });
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });

  it('maps a thrown Firebase error to a user-facing message and preserves the code', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });
    await expect(signInWithEmail('a@b.com', 'wrong')).resolves.toEqual({
      ok: false,
      code: 'auth/invalid-credential',
      message: 'Incorrect email or password.',
    });
  });
});

describe('signInWithGoogle', () => {
  it('links the credential to the existing anonymous uid on success', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
    mockGetTokens.mockResolvedValue({ idToken: 'google-id-token', accessToken: 'google-access-token' });
    mockLinkWithCredential.mockResolvedValue({
      user: { uid: 'anon-uid', email: 'a@b.com', isAnonymous: false },
    });

    await expect(signInWithGoogle()).resolves.toEqual({ ok: true });
    // Built from getTokens()'s pair, not signIn()'s response — see auth.ts:
    // GoogleAuthProvider.credential(idToken) with no accessToken bridges to
    // native as an empty string, which Android's SDK rejects.
    expect(mockLinkWithCredential).toHaveBeenCalledWith(fakeAuth.currentUser, {
      idToken: 'google-id-token',
      accessToken: 'google-access-token',
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({ uid: 'anon-uid', email: 'a@b.com', isAnonymous: false });
  });

  it('falls back to a plain sign-in when the Google account is already linked elsewhere', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
    mockGetTokens.mockResolvedValue({ idToken: 'google-id-token', accessToken: 'google-access-token' });
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    mockSignInWithCredential.mockResolvedValue({
      user: { uid: 'other-real-uid', email: 'a@b.com', isAnonymous: false },
    });

    await expect(signInWithGoogle()).resolves.toEqual({ ok: true });
    expect(mockSignInWithCredential).toHaveBeenCalledWith(fakeAuth, {
      idToken: 'google-id-token',
      accessToken: 'google-access-token',
    });
    expect(useSessionStore.getState()).toMatchObject({ uid: 'other-real-uid' });
  });

  it('resolves not-ok with a cancelled reason, without touching the session, when the user cancels', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithGoogle()).resolves.toEqual({ ok: false, reason: 'cancelled' });
    expect(mockGetTokens).not.toHaveBeenCalled();
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({ uid: null });
  });

  it('maps a thrown Firebase error to a user-facing message and preserves the code', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
    mockGetTokens.mockResolvedValue({ idToken: 'google-id-token', accessToken: 'google-access-token' });
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(signInWithGoogle()).resolves.toEqual({
      ok: false,
      reason: 'error',
      code: 'auth/network-request-failed',
      message: 'Network error. Check your connection and try again.',
    });
  });

  it('reports an account-exists conflict, without touching the session, when the email already belongs to a different real account', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-id-token', user: { email: 'a@b.com' } },
    });
    mockGetTokens.mockResolvedValue({ idToken: 'google-id-token', accessToken: 'google-access-token' });
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/email-already-in-use' });

    await expect(signInWithGoogle()).resolves.toEqual({
      ok: false,
      reason: 'account-exists',
      email: 'a@b.com',
      pendingCredential: { idToken: 'google-id-token', accessToken: 'google-access-token' },
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({ uid: null });
  });

  it('reports the same account-exists conflict when Firebase uses the account-exists-with-different-credential code instead', async () => {
    // Regression test for the auth.ts/auth.web.ts parity fix — RNFirebase's
    // linkWithCredential can surface either this code or
    // auth/email-already-in-use for the same underlying conflict, and both
    // must resolve identically here.
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-id-token', user: { email: 'a@b.com' } },
    });
    mockGetTokens.mockResolvedValue({ idToken: 'google-id-token', accessToken: 'google-access-token' });
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/account-exists-with-different-credential' });

    await expect(signInWithGoogle()).resolves.toEqual({
      ok: false,
      reason: 'account-exists',
      email: 'a@b.com',
      pendingCredential: { idToken: 'google-id-token', accessToken: 'google-access-token' },
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({ uid: null });
  });
});

describe('completeGoogleLink', () => {
  it('links the pending credential to the currently signed-in user on success', async () => {
    fakeAuth.currentUser = { uid: 'real-uid', email: 'a@b.com', isAnonymous: false };
    mockLinkWithCredential.mockResolvedValue({
      user: { uid: 'real-uid', email: 'a@b.com', isAnonymous: false },
    });

    const pendingCredential = { idToken: 'google-id-token' };
    await expect(completeGoogleLink(pendingCredential)).resolves.toEqual({ ok: true });
    expect(mockLinkWithCredential).toHaveBeenCalledWith(fakeAuth.currentUser, pendingCredential);
    expect(useSessionStore.getState()).toMatchObject({ uid: 'real-uid', email: 'a@b.com', isAnonymous: false });
  });

  it('maps a thrown Firebase error to a user-facing message and preserves the code', async () => {
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(completeGoogleLink({ idToken: 'google-id-token' })).resolves.toEqual({
      ok: false,
      code: 'auth/network-request-failed',
      message: 'Network error. Check your connection and try again.',
    });
  });
});

describe('signOutAndRestartAnonymous', () => {
  it('signs out then bootstraps a fresh anonymous session', async () => {
    mockSignOut.mockImplementation(async () => {
      fakeAuth.currentUser = null;
    });
    mockSignInAnonymously.mockImplementation(async () => {
      fakeAuth.currentUser = { uid: 'new-anon-uid', email: null, isAnonymous: true };
      return { user: fakeAuth.currentUser };
    });

    await signOutAndRestartAnonymous();

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockSignInAnonymously).toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({
      uid: 'new-anon-uid',
      isAnonymous: true,
      status: 'ready',
    });
  });
});

describe('requestPasswordReset', () => {
  it('resolves ok when the email is registered', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    await expect(requestPasswordReset('a@b.com')).resolves.toEqual({ ok: true });
  });

  it('still resolves ok when the underlying call fails, to avoid leaking account existence', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(requestPasswordReset('nobody@b.com')).resolves.toEqual({ ok: true });
  });
});
