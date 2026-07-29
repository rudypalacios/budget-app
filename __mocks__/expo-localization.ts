// Manual mock for Jest — expo-localization's native module isn't available
// in the test environment, and jest-expo has no built-in mock for it (unlike
// some other Expo packages). Auto-applied by Jest for any node_modules
// package with a same-named file here, no per-test jest.mock() needed. Keeps
// src/localization/i18n.ts's device-locale detection safe to import from any
// test file, defaulting the detected language to English.
export function getLocales() {
  return [{ languageCode: 'en', languageTag: 'en-US' }];
}
