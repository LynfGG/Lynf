import { buildRiotIdSegment, normalizeRiotId } from '@lynf/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { REGION_LABELS } from '../../constants/regions';
import {
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
    type RecentSearch,
} from '../../utils/recent-searches';

/** Same encoding as the search form: each part encoded on its own before joining. */
function profilePath({ region, gameName, tagLine }: RecentSearch): string {
    return `/${region}/${buildRiotIdSegment(gameName, tagLine)}`;
}

/**
 * The players a visitor has recently looked up, read from local storage on mount.
 * Nothing here reacts to another tab changing the list — that divergence is expected
 * and left alone, not something to synchronise.
 */
export default function RecentSearches() {
    const { t } = useTranslation('summoner');
    const [entries, setEntries] = useState<RecentSearch[]>(() => getRecentSearches());

    if (entries.length === 0) {
        return null;
    }

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink-muted">{t('search.recent.title')}</h2>
                <button
                    type="button"
                    onClick={() => {
                        clearRecentSearches();
                        setEntries([]);
                    }}
                    className="text-xs font-medium text-ink-muted transition hover:text-ink"
                >
                    {t('search.recent.clear')}
                </button>
            </div>

            <ul className="flex flex-col gap-2">
                {entries.map((entry) => {
                    const riotId = `${entry.gameName}#${entry.tagLine}`;
                    const normalized = normalizeRiotId(entry.gameName, entry.tagLine);

                    return (
                        <li
                            key={`${entry.region}/${buildRiotIdSegment(normalized.gameName, normalized.tagLine)}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                        >
                            <Link
                                to={profilePath(entry)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink"
                            >
                                <span className="truncate font-medium">
                                    {entry.gameName}
                                    <span className="text-ink-muted">#{entry.tagLine}</span>
                                </span>
                                <span className="shrink-0 text-xs text-ink-muted">
                                    {REGION_LABELS[entry.region]}
                                </span>
                            </Link>

                            <button
                                type="button"
                                onClick={() => setEntries(removeRecentSearch(entry))}
                                aria-label={t('search.recent.remove', { riotId })}
                                className="shrink-0 text-ink-muted transition hover:text-loss"
                            >
                                <span aria-hidden="true">✕</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
