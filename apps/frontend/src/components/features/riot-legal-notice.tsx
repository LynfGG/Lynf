import { useTranslation } from 'react-i18next';

/**
 * Riot requires this text verbatim, in a location readily visible to players.
 * It is identical in both languages on purpose: translating it would breach
 * their policies. See docs/conventions/i18n.md.
 */
export default function RiotLegalNotice() {
    const { t } = useTranslation();

    return <p className="text-xs leading-relaxed text-ink-faint">{t('legal.riot')}</p>;
}
