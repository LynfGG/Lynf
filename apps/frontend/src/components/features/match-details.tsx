import type { MatchSummary, RiotIdLookup } from '@lynf/shared';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChampionCatalogue } from '../../api/champion-catalogue';
import MatchDetailDuel from './match-detail-duel';
import MatchDetailGeneral from './match-detail-general';
import MatchDetailStuff from './match-detail-stuff';

type MatchDetailsProps = {
    match: MatchSummary;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    viewedPuuid: string;
    lookup: RiotIdLookup;
};

const TABS = ['general', 'duel', 'stuff'] as const;
type Tab = (typeof TABS)[number];

/**
 * The disclosure panel inside a match card, as a real tab bar over three panels:
 * General (the existing two-team breakdown — no new data, no call), Duel (the existing
 * lane-duel band plus its minute-by-minute chart) and Stuff (runes, skill order, item
 * order). Only one panel is ever mounted at a time, which is also what keeps Duel's and
 * Stuff's own match-timeline fetch from firing before their tab is actually opened —
 * see `useMatchTimeline`.
 *
 * Every tab is reachable with the arrow keys (`Home`/`End` jump to the first/last), the
 * active tab is announced as such through `aria-selected`, and the visible panel is
 * associated with it through `aria-controls`/`aria-labelledby` — the same disclosure
 * behaviour the match card itself already had is untouched by any of this.
 */
export default function MatchDetails({
    match,
    version,
    catalogue,
    viewedPuuid,
    lookup,
}: Readonly<MatchDetailsProps>) {
    const { t, i18n } = useTranslation('summoner');
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const baseId = `match-detail-${match.matchId}`;
    const tabId = (tab: Tab) => `${baseId}-tab-${tab}`;
    const panelId = (tab: Tab) => `${baseId}-panel-${tab}`;

    const focusTab = (index: number) => {
        const nextTab = TABS[index];
        setActiveTab(nextTab);
        tabRefs.current[index]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = TABS.indexOf(activeTab);

        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                focusTab((currentIndex + 1) % TABS.length);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                focusTab((currentIndex - 1 + TABS.length) % TABS.length);
                break;
            case 'Home':
                event.preventDefault();
                focusTab(0);
                break;
            case 'End':
                event.preventDefault();
                focusTab(TABS.length - 1);
                break;
            default:
                break;
        }
    };

    return (
        <div className="flex flex-col gap-4 border-t border-line pt-3">
            <div
                role="tablist"
                aria-label={t('profile.matches.detail.tabs.label')}
                className="flex gap-1 border-b border-line"
                onKeyDown={handleKeyDown}
            >
                {TABS.map((tab, index) => (
                    <button
                        key={tab}
                        ref={(element) => {
                            tabRefs.current[index] = element;
                        }}
                        type="button"
                        role="tab"
                        id={tabId(tab)}
                        aria-selected={activeTab === tab}
                        aria-controls={panelId(tab)}
                        tabIndex={activeTab === tab ? 0 : -1}
                        onClick={() => setActiveTab(tab)}
                        className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
                            activeTab === tab
                                ? 'border-gold text-ink'
                                : 'border-transparent text-ink-muted hover:text-ink'
                        }`}
                    >
                        {t(`profile.matches.detail.tabs.${tab}`)}
                    </button>
                ))}
            </div>

            {activeTab === 'general' && (
                <div
                    id={panelId('general')}
                    role="tabpanel"
                    aria-labelledby={tabId('general')}
                    tabIndex={0}
                >
                    <MatchDetailGeneral
                        participants={match.participants}
                        viewedPuuid={viewedPuuid}
                        version={version}
                        catalogue={catalogue}
                        language={i18n.language}
                    />
                </div>
            )}

            {activeTab === 'duel' && (
                <div
                    id={panelId('duel')}
                    role="tabpanel"
                    aria-labelledby={tabId('duel')}
                    tabIndex={0}
                >
                    <MatchDetailDuel match={match} lookup={lookup} language={i18n.language} />
                </div>
            )}

            {activeTab === 'stuff' && (
                <div
                    id={panelId('stuff')}
                    role="tabpanel"
                    aria-labelledby={tabId('stuff')}
                    tabIndex={0}
                >
                    <MatchDetailStuff match={match} lookup={lookup} version={version} />
                </div>
            )}
        </div>
    );
}
