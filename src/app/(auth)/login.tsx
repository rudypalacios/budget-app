import { router } from 'expo-router';
import { useState } from 'react';
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
import { signInWithGoogle } from '@/store/session';

const TITLES: Record<AuthFormMode, string> = {
  signUp: 'Create Account',
  signIn: 'Log In',
  reset: 'Reset Password',
};

const SUBMIT_LABELS: Record<AuthFormMode, string> = {
  signUp: 'Sign Up',
  signIn: 'Log In',
  reset: 'Send Reset Email',
};

export default function LoginScreen() {
  const form = useAuthForm();
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function handleSubmit() {
    const succeeded = await form.submit();
    if (succeeded) router.back();
  }

  async function handleGoogleSignIn() {
    setGoogleError(null);
    const result = await signInWithGoogle();
    if (result.ok) {
      router.back();
    } else if (result.code !== 'cancelled') {
      setGoogleError(result.message);
    }
  }

  return (
    <ScreenScroll>
      <ModalHeader
        title={TITLES[form.mode]}
        // Reset Password is an in-place mode of this same screen, not a
        // separate route (see useAuthForm) — back should return to Log In,
        // not dismiss the whole auth modal, mirroring the existing "Back to
        // Log In" link below.
        onBack={form.mode === 'reset' ? () => form.setMode('signIn') : () => router.back()}
      />

      {form.mode !== 'reset' && (
        <View style={styles.modeRow}>
          <Pressable onPress={() => form.setMode('signIn')} accessibilityRole="button" accessibilityLabel="Log in">
            <Chip label="Log In" tone={form.mode === 'signIn' ? 'success' : 'neutral'} />
          </Pressable>
          <Pressable onPress={() => form.setMode('signUp')} accessibilityRole="button" accessibilityLabel="Sign up">
            <Chip label="Sign Up" tone={form.mode === 'signUp' ? 'success' : 'neutral'} />
          </Pressable>
        </View>
      )}

      {form.resetConfirmationVisible ? (
        <ThemedText accessibilityRole="alert">
          If an account exists for that email, a password reset link has been sent.
        </ThemedText>
      ) : (
        <View style={styles.form}>
          <TextField
            label="Email"
            value={form.email}
            onChangeText={form.setEmail}
            error={form.emailError ?? undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {form.mode !== 'reset' && (
            <TextField
              label="Password"
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

          <Button label={SUBMIT_LABELS[form.mode]} onPress={handleSubmit} />

          {form.mode === 'signIn' && (
            <Pressable onPress={() => form.setMode('reset')} accessibilityRole="button" accessibilityLabel="Forgot password?">
              <ThemedText type="linkPrimary">Forgot password?</ThemedText>
            </Pressable>
          )}

          {form.mode === 'reset' && (
            <Pressable onPress={() => form.setMode('signIn')} accessibilityRole="button" accessibilityLabel="Back to log in">
              <ThemedText type="linkPrimary">Back to Log In</ThemedText>
            </Pressable>
          )}

          {form.mode !== 'reset' && (
            <View style={styles.googleSection}>
              <View style={styles.dividerRow}>
                <Divider style={styles.dividerLine} />
                <ThemedText type="caption">or</ThemedText>
                <Divider style={styles.dividerLine} />
              </View>

              <Button label="Continue with Google" variant="secondary" onPress={handleGoogleSignIn} />

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
