import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';

export type SupportedLanguage = 'en' | 'es';

// Only used as the pre-Firestore default, before UserSettings.language has
// loaded — _layout.tsx switches i18next over to the real persisted
// preference as soon as it's available (see subscribeUserSettings wiring).
function detectDeviceLanguage(): SupportedLanguage {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return deviceLanguageCode === 'es' ? 'es' : 'en';
}

// i18next's documented chained-init idiom; the default export's own `.use()`
// method is what's meant here, not the package's separate named `use` export.
// eslint-disable-next-line import/no-named-as-default-member
i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18next;
