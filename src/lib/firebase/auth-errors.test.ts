import { mapAuthErrorMessage } from './auth-errors';

describe('mapAuthErrorMessage', () => {
  it('maps auth/email-already-in-use', () => {
    expect(mapAuthErrorMessage('auth/email-already-in-use')).toBe(
      'An account with this email already exists.'
    );
  });

  it('maps auth/invalid-email', () => {
    expect(mapAuthErrorMessage('auth/invalid-email')).toBe('Enter a valid email address.');
  });

  it('maps auth/weak-password', () => {
    expect(mapAuthErrorMessage('auth/weak-password')).toBe(
      'Password must be at least 6 characters.'
    );
  });

  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'])(
    'maps %s to a generic incorrect-credentials message',
    (code) => {
      expect(mapAuthErrorMessage(code)).toBe('Incorrect email or password.');
    }
  );

  it('maps auth/credential-already-in-use', () => {
    expect(mapAuthErrorMessage('auth/credential-already-in-use')).toBe(
      'This email is already linked to another account.'
    );
  });

  it('maps auth/too-many-requests', () => {
    expect(mapAuthErrorMessage('auth/too-many-requests')).toBe(
      'Too many attempts. Please wait a moment and try again.'
    );
  });

  it('maps auth/operation-not-allowed', () => {
    expect(mapAuthErrorMessage('auth/operation-not-allowed')).toBe(
      'Email/password sign-in is not enabled for this app yet.'
    );
  });

  it('maps auth/network-request-failed', () => {
    expect(mapAuthErrorMessage('auth/network-request-failed')).toBe(
      'Network error. Check your connection and try again.'
    );
  });

  it('falls back to a generic message for unrecognized codes', () => {
    expect(mapAuthErrorMessage('auth/some-unknown-code')).toBe(
      'Something went wrong. Please try again.'
    );
  });
});
