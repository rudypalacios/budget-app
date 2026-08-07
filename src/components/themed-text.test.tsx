import { render, screen } from '@testing-library/react-native';

// Mocks first — same idiom as expenses.test.ts/incomes.test.ts. ThemedText
// now pulls in use-theme.ts's useResolvedColorScheme, which reads
// useUserSettingsStore as a hook (not .getState()) — this avoids that
// transitively loading the real user-settings.ts -> create-document-store.ts
// -> the native @react-native-firebase/app module (not available under Jest).
/* eslint-disable import/first */
jest.mock('@/store/user-settings', () => ({
  useUserSettingsStore: (selector: (state: { data: null }) => unknown) => selector({ data: null }),
}));

import { ThemedText } from './themed-text';
/* eslint-enable import/first */

test('renders its children', () => {
  render(<ThemedText>Budget</ThemedText>);
  expect(screen.getByText('Budget')).toBeTruthy();
});
