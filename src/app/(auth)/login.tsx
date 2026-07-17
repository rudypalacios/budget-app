import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/modal-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuthForm, type AuthFormMode } from '@/features/auth/use-auth-form';

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

  async function handleSubmit() {
    const succeeded = await form.submit();
    if (succeeded) router.back();
  }

  return (
    <ScreenScroll>
      <ModalHeader title={TITLES[form.mode]} onBack={() => router.back()} />

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
        </View>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
});
