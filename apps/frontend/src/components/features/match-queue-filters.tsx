import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ALL_QUEUES, type QueueFilter } from '../../utils/match-queue-filter';

type MatchQueueFiltersProps = {
    /** Queue-name keys actually present among the loaded matches — see `listPresentQueueFilters`. */
    queues: readonly string[];
    selected: QueueFilter;
    onSelect: (filter: QueueFilter) => void;
};

function FilterPill({
    active,
    onClick,
    children,
}: Readonly<{ active: boolean; onClick: () => void; children: ReactNode }>) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={`h-8 shrink-0 rounded-full px-3 text-sm font-semibold transition ${
                active ? 'bg-gold text-ground' : 'border border-line text-ink-muted hover:text-ink'
            }`}
        >
            {children}
        </button>
    );
}

/**
 * One pill per queue actually present among the loaded matches, plus "all queues" —
 * never Riot's full queue catalogue, most of which a given player has never touched.
 *
 * Filtering happens entirely on matches already fetched: picking a pill never triggers
 * a network call, to Riot or to our own server.
 */
export default function MatchQueueFilters({
    queues,
    selected,
    onSelect,
}: Readonly<MatchQueueFiltersProps>) {
    const { t } = useTranslation('summoner');

    return (
        <ul className="flex flex-wrap items-center gap-2">
            <li>
                <FilterPill active={selected === ALL_QUEUES} onClick={() => onSelect(ALL_QUEUES)}>
                    {t('profile.matches.filters.all')}
                </FilterPill>
            </li>

            {queues.map((queueKey) => (
                <li key={queueKey}>
                    <FilterPill active={selected === queueKey} onClick={() => onSelect(queueKey)}>
                        {t(`profile.matches.queue.${queueKey}`)}
                    </FilterPill>
                </li>
            ))}
        </ul>
    );
}
