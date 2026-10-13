import { DEFAULT_LOCALE, isLocale, type Locale, SUPPORTED_LOCALES } from '@flowbit/shared';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';

export const resources = {
  en: { translation: en },
  ko: { translation: ko },
} as const;

export const LANGUAGE_STORAGE_KEY = 'flowbit.language';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});
document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LOCALE;

export function currentLocale(): Locale {
  const language = i18n.resolvedLanguage;
  return isLocale(language) ? language : DEFAULT_LOCALE;
}

export default i18n;
