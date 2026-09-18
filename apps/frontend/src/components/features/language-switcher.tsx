import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES } from '../../i18n';

/** Without this, the second language is unreachable — and therefore pointless. */
export default function LanguageSwitcher() {
    const { t, i18n } = useTranslation();

    return (
        <div role="group" className="flex items-center gap-1" aria-label={t('language.label')}>
            {SUPPORTED_LANGUAGES.map((language) => (
                <button
                    key={language}
                    type="button"
                    onClick={() => void i18n.changeLanguage(language)}
                    aria-current={i18n.resolvedLanguage === language}
                    className={`rounded px-2 py-1 text-xs font-semibold transition ${
                        i18n.resolvedLanguage === language
                            ? 'bg-surface-raised text-ink'
                            : 'text-ink-muted hover:text-ink'
                    }`}
                >
                    {t(`language.${language}`)}
                </button>
            ))}
        </div>
    );
}
