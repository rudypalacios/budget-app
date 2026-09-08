import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { Toast } from '@/components/ui/toast';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useResolvedColorScheme } from '@/hooks/use-theme';
import i18n from '@/localization/i18n';
import { seedDefaultCategories, subscribeCategories, useCategoriesStore } from '@/store/categories';
import { subscribeCurrencies } from '@/store/currencies';
import { subscribeExpenses, useExpensesStore } from '@/store/expenses';
import { subscribeIncomes, useIncomesStore } from '@/store/incomes';
import { runRecurringGeneration } from '@/store/recurring-generation';
import { subscribeRecurringExpenses, useRecurringExpensesStore } from '@/store/recurring-expenses';
import { subscribeRecurringGroups } from '@/store/recurring-groups';
import { subscribeRecurringIncomes, useRecurringIncomesStore } from '@/store/recurring-incomes';
import { bootstrapSession, subscribeAuthState, useSessionStore } from '@/store/session';
import { seedDefaultUserSettings, subscribeUserSettings, useUserSettingsStore } from '@/store/user-settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useResolvedColorScheme();
  const isOnline = useNetworkStatus();
  const uid = useSessionStore((state) => state.uid);
  const isAnonymous = useSessionStore((state) => state.isAnonymous);
  const categoriesLoading = useCategoriesStore((state) => state.isLoading);
  const categoriesCount = useCategoriesStore((state) => state.items.length);
  const expensesLoading = useExpensesStore((state) => state.isLoading);
  const incomesLoading = useIncomesStore((state) => state.isLoading);
  const recurringExpensesLoading = useRecurringExpensesStore((state) => state.isLoading);
  const recurringIncomesLoading = useRecurringIncomesStore((state) => state.isLoading);
  const userSettingsLoading = useUserSettingsStore((state) => state.isLoading);
  const userSettings = useUserSettingsStore((state) => state.data);

  useEffect(() => {
    bootstrapSession();
    // Keeps uid/email/isAnonymous in sync with every later sign-up/in/out,
    // not just this initial bootstrap (Stage 9a) — see session.ts.
    subscribeAuthState();
  }, []);

  // Starts the six listeners once a uid is available (anonymous or, since
  // Stage 9a, a real signed-in account) — reactive to uid changes, so
  // signing in/out on this device also re-subscribes to that account's own
  // data.
  useEffect(() => {
    if (!uid) return;
    subscribeCategories(uid);
    subscribeCurrencies(uid);
    subscribeExpenses(uid);
    subscribeIncomes(uid);
    subscribeRecurringExpenses(uid);
    subscribeRecurringGroups(uid);
    subscribeRecurringIncomes(uid);
    subscribeUserSettings(uid);
  }, [uid]);

  // First-run seed for a brand-new account (data-model.md §4's
  // isSystemDefault list) — fires once the categories listener has resolved
  // with zero documents.
  useEffect(() => {
    if (!uid || categoriesLoading || categoriesCount > 0) return;
    seedDefaultCategories();
  }, [uid, categoriesLoading, categoriesCount]);

  // First-run seed for the users/{uid} settings doc (Stage 10) — fires once
  // the settings listener has resolved with no doc yet. Uses i18n's
  // already-device-detected language as the seed's initial value, since a
  // brand-new account has no persisted language preference yet.
  useEffect(() => {
    if (!uid || userSettingsLoading || userSettings) return;
    seedDefaultUserSettings(i18n.language === 'es' ? 'es' : 'en');
  }, [uid, userSettingsLoading, userSettings]);

  // Once the real persisted language preference loads, it overrides i18n's
  // device-locale guess (see src/localization/i18n.ts).
  useEffect(() => {
    if (!userSettings || userSettings.language === i18n.language) return;
    i18n.changeLanguage(userSettings.language);
  }, [userSettings]);

  // Launch-time recurring-instance catch-up scan (Stage 6b, data-model.md
  // §9) — waits for all five stores to have resolved their first snapshot
  // so the generator has the full picture (active definitions + each one's
  // last-generated instance) before deciding what's missing.
  useEffect(() => {
    if (
      !uid ||
      categoriesLoading ||
      expensesLoading ||
      incomesLoading ||
      recurringExpensesLoading ||
      recurringIncomesLoading
    ) {
      return;
    }
    runRecurringGeneration(uid);
  }, [
    uid,
    categoriesLoading,
    expensesLoading,
    incomesLoading,
    recurringExpensesLoading,
    recurringIncomesLoading,
  ]);

  // Re-runs the same catch-up scan on foreground-resume, not just launch
  // (previously a Known Issue: a recurring instance for a new cycle only
  // appeared after fully closing and reopening the app — backgrounding/
  // foregrounding, switching tabs, or pulling to refresh did nothing).
  // runRecurringGeneration is idempotent (setAt on deterministic IDs) and
  // self-guards against overlapping calls, so re-running it here is safe.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && uid) {
        runRecurringGeneration(uid);
      }
    });
    return () => subscription.remove();
  }, [uid]);

  // Separately covers reconnecting without backgrounding the app at all —
  // this is what actually resolves a definition whose immediate
  // generation call was skipped while offline (see expenses/new.tsx and
  // income/new.tsx, which no longer await that call offline to avoid
  // hanging the Save button indefinitely).
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current && uid) {
      runRecurringGeneration(uid);
    }
    wasOnline.current = isOnline;
  }, [isOnline, uid]);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="categories/index" />
        <Stack.Screen name="expenses/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="expenses/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="income/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="income/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="payments/quick-expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categories/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categories/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recurring-expenses/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recurring-incomes/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="currencies/index" />
        <Stack.Screen name="currencies/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="currencies/[code]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="archive/index" />
        <Stack.Screen name="trash/index" />
        <Stack.Screen name="recurring-groups/index" />
        {/* Excludes the login screen from the navigator entirely (not just a
            post-mount redirect) once already signed in for real, so it can
            never render even for a single frame — reached while already
            signed in for real, the router bounces to the anchor/home route
            automatically before this screen is ever mounted. */}
        <Stack.Protected guard={isAnonymous}>
          <Stack.Screen name="(auth)/login" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}
