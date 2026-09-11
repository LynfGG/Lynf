import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enCommon from './en/common.json';
import enSummoner from './en/summoner.json';
import frCommon from './fr/common.json';
import frSummoner from './fr/summoner.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// The page declares the language it is shown in: screen readers pick their voice from
// it, and browsers their hyphenation and translation offers. Registered before `init`,
// so the detected language is applied too.
i18next.on('languageChanged', (language) => {
    document.documentElement.lang = language;
});

/**
 * Two languages ship from the start. English is the fallback: it is the language
 * of the game's own vocabulary, and of the legal notice Riot imposes verbatim.
 *
 * CI checks that both languages hold exactly the same keys, so a string added on
 * one side and forgotten on the other fails the build rather than the page.
 */
void i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { common: enCommon, summoner: enSummoner },
            fr: { common: frCommon, summoner: frSummoner },
        },
        supportedLngs: SUPPORTED_LANGUAGES,
        fallbackLng: 'en',
        defaultNS: 'common',
        interpolation: { escapeValue: false },
    });

export default i18next;
