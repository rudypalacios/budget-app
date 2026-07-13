import { act, renderHook } from '@testing-library/react-native';

// jest.mock() must come before the imports below (see src/store/session.test.ts
// for the same idiom and why) — mocking this '@/'-aliased path isn't reliably
// hoisted above a real import of it, so source order here is load-bearing.
/* eslint-disable import/first */
jest.mock('@/store/session', () => ({
  requestPasswordReset: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
}));

import { requestPasswordReset, signInWithEmail, signUpWithEmail } from '@/store/session';
import { useAuthForm } from './use-auth-form';
/* eslint-enable import/first */

const mockSignUpWithEmail = signUpWithEmail as jest.Mock;
const mockSignInWithEmail = signInWithEmail as jest.Mock;
const mockRequestPasswordReset = requestPasswordReset as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('sign-up mode calls signUpWithEmail (the linking path), never signInWithEmail', async () => {
  mockSignUpWithEmail.mockResolvedValue({ ok: true });
  const { result } = renderHook(() => useAuthForm());

  act(() => {
    result.current.setMode('signUp');
    result.current.setEmail('new@example.com');
    result.current.setPassword('password123');
  });

  await act(async () => {
    await result.current.submit();
  });

  expect(mockSignUpWithEmail).toHaveBeenCalledWith('new@example.com', 'password123');
  expect(mockSignInWithEmail).not.toHaveBeenCalled();
});

test('sign-in mode calls signInWithEmail (the direct-swap path), never signUpWithEmail', async () => {
  mockSignInWithEmail.mockResolvedValue({ ok: true });
  const { result } = renderHook(() => useAuthForm());

  act(() => {
    result.current.setMode('signIn');
    result.current.setEmail('existing@example.com');
    result.current.setPassword('password123');
  });

  await act(async () => {
    await result.current.submit();
  });

  expect(mockSignInWithEmail).toHaveBeenCalledWith('existing@example.com', 'password123');
  expect(mockSignUpWithEmail).not.toHaveBeenCalled();
});

test('on auth/email-already-in-use during sign-up, switches to sign-in mode with the email prefilled', async () => {
  mockSignUpWithEmail.mockResolvedValue({
    ok: false,
    code: 'auth/email-already-in-use',
    message: 'An account with this email already exists.',
  });
  const { result } = renderHook(() => useAuthForm());

  act(() => {
    result.current.setMode('signUp');
    result.current.setEmail('taken@example.com');
    result.current.setPassword('password123');
  });

  await act(async () => {
    await result.current.submit();
  });

  expect(result.current.mode).toBe('signIn');
  expect(result.current.email).toBe('taken@example.com');
  // Regression check: setMode() clears formError as part of its normal
  // manual-switch reset, which previously wiped out the very message
  // explaining why the mode just changed — the message must survive this
  // auto-switch.
  expect(result.current.formError).toBe('An account with this email already exists.');
});

test('does not switch modes for other sign-up failures (e.g. weak password)', async () => {
  mockSignUpWithEmail.mockResolvedValue({
    ok: false,
    code: 'auth/weak-password',
    message: 'Password must be at least 6 characters.',
  });
  const { result } = renderHook(() => useAuthForm());

  act(() => {
    result.current.setMode('signUp');
    result.current.setEmail('new@example.com');
    result.current.setPassword('123');
  });

  await act(async () => {
    await result.current.submit();
  });

  expect(result.current.mode).toBe('signUp');
  expect(result.current.formError).toBe('Password must be at least 6 characters.');
});

test('reset mode calls requestPasswordReset and shows the confirmation, without touching sign-up/sign-in', async () => {
  mockRequestPasswordReset.mockResolvedValue({ ok: true });
  const { result } = renderHook(() => useAuthForm());

  act(() => {
    result.current.setMode('reset');
    result.current.setEmail('someone@example.com');
  });

  await act(async () => {
    await result.current.submit();
  });

  expect(mockRequestPasswordReset).toHaveBeenCalledWith('someone@example.com');
  expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  expect(mockSignInWithEmail).not.toHaveBeenCalled();
  expect(result.current.resetConfirmationVisible).toBe(true);
});

test('rejects an invalid email before calling any session action', async () => {
  const { result } = renderHook(() => useAuthForm());

  act(() => {
    result.current.setMode('signIn');
    result.current.setEmail('not-an-email');
    result.current.setPassword('password123');
  });

  await act(async () => {
    await result.current.submit();
  });

  expect(result.current.emailError).toBe('Enter a valid email address.');
  expect(mockSignInWithEmail).not.toHaveBeenCalled();
});
