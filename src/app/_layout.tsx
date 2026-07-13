import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { seedDefaultCategories, subscribeCategories, useCategoriesStore } from '@/store/categories';
import { subscribeExpenses, useExpensesStore } from '@/store/expenses';
import { subscribeIncomes, useIncomesStore } from '@/store/incomes';
import { runRecurringGeneration } from '@/store/recurring-generation';
import { subscribeRecurringExpenses, useRecurringExpensesStore } from '@/store/recurring-expenses';
import { subscribeRecurringIncomes, useRecurringIncomesStore } from '@/store/recurring-incomes';
import { bootstrapSession, subscribeAuthState, useSessionStore } from '@/store/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const uid = useSessionStore((state) => state.uid);
  const categoriesLoading = useCategoriesStore((state) => state.isLoading);
  const categoriesCount = useCategoriesStore((state) => state.items.length);
  const expensesLoading = useExpensesStore((state) => state.isLoading);
  const incomesLoading = useIncomesStore((state) => state.isLoading);
  const recurringExpensesLoading = useRecurringExpensesStore((state) => state.isLoading);
  const recurringIncomesLoading = useRecurringIncomesStore((state) => state.isLoading);

  useEffect(() => {
    bootstrapSession();
    // Keeps uid/email/isAnonymous in sync with every later sign-up/in/out,
    // not just this initial bootstrap (Stage 9a) — see session.ts.
    subscribeAuthState();
  }, []);

  // Starts the five collection listeners once a uid is available (anonymous
  // or, since Stage 9a, a real signed-in account) — reactive to uid changes,
  // so signing in/out on this device also re-subscribes to that account's
  // own data.
  useEffect(() => {
    if (!uid) return;
    subscribeCategories(uid);
    subscribeExpenses(uid);
    subscribeIncomes(uid);
    subscribeRecurringExpenses(uid);
    subscribeRecurringIncomes(uid);
  }, [uid]);

  // First-run seed for a brand-new account (data-model.md §4's
  // isSystemDefault list) — fires once the categories listener has resolved
  // with zero documents.
  useEffect(() => {
    if (!uid || categoriesLoading || categoriesCount > 0) return;
    seedDefaultCategories();
  }, [uid, categoriesLoading, categoriesCount]);

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
        <Stack.Screen name="(auth)/login" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
