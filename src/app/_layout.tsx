import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { categoriesStore, expensesStore, incomesStore } from '@/lib/mock-stores';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <categoriesStore.Provider>
        <expensesStore.Provider>
          <incomesStore.Provider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="categories/index" />
              <Stack.Screen name="expenses/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="expenses/[id]/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="income/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="income/[id]/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="categories/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="categories/[id]/edit" options={{ presentation: 'modal' }} />
            </Stack>
          </incomesStore.Provider>
        </expensesStore.Provider>
      </categoriesStore.Provider>
    </ThemeProvider>
  );
}
