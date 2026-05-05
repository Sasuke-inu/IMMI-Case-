import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'

const BCP47_MAP: Record<string, string> = {
  en: 'en-AU',
  'en-AU': 'en-AU',
  'zh-TW': 'zh-Hant-AU',
}

function syncHtmlLang(lng: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = BCP47_MAP[lng] ?? lng
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      'zh-TW': { common: zhTW },
    },
    ns: ['common'],
    defaultNS: 'common',
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

// Sync <html lang> on every language switch (WCAG 3.1.1)
i18n.on('languageChanged', syncHtmlLang)

// Set initial value once the detected language is known
if (i18n.language) {
  syncHtmlLang(i18n.language)
}

export default i18n
