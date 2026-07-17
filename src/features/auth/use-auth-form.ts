import { useState } from 'react';

import { requestPasswordReset, signInWithEmail, signUpWithEmail } from '@/store/session';

export type AuthFormMode = 'signUp' | 'signIn' | 'reset';

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

export function useAuthForm() {
  const [mode, setModeState] = useState<AuthFormMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetConfirmationVisible, setResetConfirmationVisible] = useState(false);

  function setMode(nextMode: AuthFormMode) {
    setModeState(nextMode);
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
    setResetConfirmationVisible(false);
  }

  // Resolves true only once the caller can navigate away (a successful
  // sign-up/sign-in) — the reset flow never "completes" this way, it just
  // shows a confirmation message in place of the form.
  async function submit(): Promise<boolean> {
    setFormError(null);

    const trimmedEmail = email.trim();
    const nextEmailError = isValidEmail(trimmedEmail) ? null : 'Enter a valid email address.';
    const nextPasswordError = mode !== 'reset' && password.length === 0 ? 'Enter your password.' : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return false;

    if (mode === 'reset') {
      await requestPasswordReset(trimmedEmail);
      setResetConfirmationVisible(true);
      return false;
    }

    const result =
      mode === 'signUp' ? await signUpWithEmail(trimmedEmail, password) : await signInWithEmail(trimmedEmail, password);

    if (!result.ok) {
      // This email already belongs to a different, already-real account —
      // linking can't succeed, so switch to the matching sign-in action
      // instead of a dead-end error. setMode() itself clears formError (it's
      // meant to wipe stale state on a manual mode switch), so it must run
      // before setFormError here, not after — otherwise the explanation for
      // why the mode just changed gets wiped out along with it.
      if (mode === 'signUp' && result.code === 'auth/email-already-in-use') {
        setMode('signIn');
        setEmail(trimmedEmail);
      }
      setFormError(result.message);
      return false;
    }

    return true;
  }

  return {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    emailError,
    passwordError,
    formError,
    resetConfirmationVisible,
    submit,
  };
}
