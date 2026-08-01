import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuthForm, type AuthFormMode } from '@/features/auth/use-auth-form';
import { goBack } from '@/lib/navigation';
import { completeGoogleLink, signInWithGoogle } from '@/store/session';

const TITLE_KEY: Record<AuthFormMode, string> = {
  signUp: 'auth.title.signUp',
  signIn: 'auth.title.signIn',
  reset: 'auth.title.reset',
};

const SUBMIT_LABEL_KEY: Record<AuthFormMode, string> = {
  signUp: 'auth.submitLabel.signUp',
  signIn: 'auth.submitLabel.signIn',
  reset: 'auth.submitLabel.reset',
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const form = useAuthForm();
  const [googleError, setGoogleError] = useState<string | null>(null);
  // Set only when signInWithGoogle reports an 'account-exists' conflict —
  // this same Google account's email already belongs to a different real
  // account. Holding the credential here (rather than in the session store)
  // is deliberate: it's only ever needed for the rest of this screen's
  // lifetime, to finish the join once the user proves ownership below by
  // signing in with their password.
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<unknown | null>(null);
  const [googleLinkPrompt, setGoogleLinkPrompt] = useState<string | null>(null);

  function clearGoogleState() {
    setGoogleError(null);
    setPendingGoogleCredential(null);
    setGoogleLinkPrompt(null);
  }

  async function handleSubmit() {
    const succeeded = await form.submit();
    if (!succeeded) return;

    if (pendingGoogleCredential) {
      // The user just proved ownership of the conflicting account by
      // signing in with their password — finish joining the Google
      // credential captured earlier onto that same (now current) account.
      const linkResult = await completeGoogleLink(pendingGoogleCredential);
      if (!linkResult.ok) {
        // They're still signed in to the right account either way — this
        // step failing just means Google isn't linked yet, so surface it
        // but don't block navigating away.
        setGoogleError(linkResult.message);
      }
      setPendingGoogleCredential(null);
      setGoogleLinkPrompt(null);
    }

    goBack();
  }

  async function handleGoogleSignIn() {
    clearGoogleState();
    const result = await signInWithGoogle();
    if (result.ok) {
      goBack();
      return;
    }
    if (result.reason === 'cancelled') return;
    if (result.reason === 'account-exists') {
      // Firebase enforces one account per email — this Google account
      // can't be linked until the user proves ownership of the existing
      // account by signing in with its password. Redirect them into that
      // exact flow rather than dead-ending.
      setPendingGoogleCredential(result.pendingCredential);
      form.setMode('signIn');
      form.setEmail(result.email ?? '');
      setGoogleLinkPrompt(t('auth.googleLinkPrompt'));
      return;
    }
    setGoogleError(result.message);
  }

  return (
    <ScreenScroll>
      <ModalHeader
        title={t(TITLE_KEY[form.mode])}
        // Reset Password is an in-place mode of this same screen, not a
        // separate route (see useAuthForm) — back should return to Log In,
        // not dismiss the whole auth modal, mirroring the existing "Back to
        // Log In" link below.
        onBack={form.mode === 'reset' ? () => form.setMode('signIn') : () => goBack()}
      />

      {form.mode !== 'reset' && (
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => {
              clearGoogleState();
              form.setMode('signIn');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('auth.accessibility.logIn')}
          >
            <Chip label={t('auth.modeChip.logIn')} tone={form.mode === 'signIn' ? 'success' : 'neutral'} />
          </Pressable>
          <Pressable
            onPress={() => {
              clearGoogleState();
              form.setMode('signUp');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('auth.accessibility.signUp')}
          >
            <Chip label={t('auth.modeChip.signUp')} tone={form.mode === 'signUp' ? 'success' : 'neutral'} />
          </Pressable>
        </View>
      )}

      {form.resetConfirmationVisible ? (
        <ThemedText accessibilityRole="alert">{t('auth.resetConfirmation')}</ThemedText>
      ) : (
        <View style={styles.form}>
          {googleLinkPrompt ? <ThemedText accessibilityRole="alert">{googleLinkPrompt}</ThemedText> : null}

          <TextField
            label={t('auth.email')}
            value={form.email}
            onChangeText={form.setEmail}
            error={form.emailError ?? undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {form.mode !== 'reset' && (
            <TextField
              label={t('auth.password')}
              value={form.password}
              onChangeText={form.setPassword}
              error={form.passwordError ?? undefined}
              secureTextEntry
              autoCapitalize="none"
            />
          )}

          {form.formError ? (
            <ThemedText themeColor="danger" accessibilityRole="alert">
              {form.formError}
            </ThemedText>
          ) : null}

          <Button label={t(SUBMIT_LABEL_KEY[form.mode])} onPress={handleSubmit} />

          {form.mode === 'signIn' && (
            <Pressable
              onPress={() => form.setMode('reset')}
              accessibilityRole="button"
              accessibilityLabel={t('auth.accessibility.forgotPassword')}
            >
              <ThemedText type="linkPrimary">{t('auth.forgotPassword')}</ThemedText>
            </Pressable>
          )}

          {form.mode === 'reset' && (
            <Pressable
              onPress={() => form.setMode('signIn')}
              accessibilityRole="button"
              accessibilityLabel={t('auth.accessibility.backToLogIn')}
            >
              <ThemedText type="linkPrimary">{t('auth.backToLogIn')}</ThemedText>
            </Pressable>
          )}

          {form.mode !== 'reset' && (
            <View style={styles.googleSection}>
              <View style={styles.dividerRow}>
                <Divider style={styles.dividerLine} />
                <ThemedText type="caption">{t('auth.or')}</ThemedText>
                <Divider style={styles.dividerLine} />
              </View>

              <Button label={t('auth.continueWithGoogle')} variant="secondary" onPress={handleGoogleSignIn} />

              {googleError ? (
                <ThemedText themeColor="danger" accessibilityRole="alert">
                  {googleError}
                </ThemedText>
              ) : null}
            </View>
          )}
        </View>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  googleSection: {
    gap: Spacing.three,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dividerLine: {
    flex: 1,
  },
});
