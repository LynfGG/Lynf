import type { MatchSummary, RiotIdLookup } from '@lynf/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import { useChampionCatalogue } from '../../hooks/use-champion-catalogue';
import { useDataDragonVersion } from '../../hooks/use-data-dragon-version';
import {
    ALL_QUEUES,
    filterMatchesByQueue,
    listPresentQueueFilters,
    type QueueFilter,
} from '../../utils/match-queue-filter';
import { summarizeMatches } from '../../utils/match-summary';
import MatchCard from './match-card';
import MatchQueueFilters from './match-queue-filters';
import MatchSummaryBand from './match-summary-band';

type MatchListProps = {
    matches: MatchSummary[] | undefined;
    isPending: boolean;
    error: Error | null;
    /** The puuid of the profile this page is showing, to highlight it in a team breakdown. */
    viewedPuuid: string;
    /** The profile this page is showing, needed to fetch a match's timeline on demand. */
    lookup: RiotIdLookup;
};

/**
 * The match history section of a profile — the "Duel" mockup's identity feature: each
 * row carries its duel column when one could be identified, and can be expanded in
 * place for the lane duel and the full two-team breakdown. Only one match is ever open
 * at a time, so opening a second closes whichever was open before it.
 *
 * Above the list, one row holds the queue filter pills and the summary band. Both work
 * on `matches` already in memory — the filter never triggers a new fetch, and the
 * summary always recomputes from whichever matches the filter currently keeps, so the
 * two can never show numbers that contradict what is listed underneath.
 */
export default function MatchList({
    matches,
    isPending,
    error,
    viewedPuuid,
    lookup,
}: Readonly<MatchListProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { data: version } = useDataDragonVersion();
    const { data: catalogue } = useChampionCatalogue();
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
    // UI state only, never a copy of the matches themselves: which pill is picked. The
    // matches stay TanStack Query's property; this is just an id to filter them by.
    const [queueFilter, setQueueFilter] = useState<QueueFilter>(ALL_QUEUES);

    if (isPending) {
        return <p className="text-sm text-ink-muted">{t('profile.matches.loading')}</p>;
    }

    if (error) {
        return (
            <p role="alert" className="text-sm text-loss">
                {messageFor(error)}
            </p>
        );
    }

    if (!matches || matches.length === 0) {
        return <p className="text-sm text-ink-muted">{t('profile.matches.empty')}</p>;
    }

    const presentQueues = listPresentQueueFilters(matches);
    const filteredMatches = filterMatchesByQueue(matches, queueFilter);
    const summary = summarizeMatches(filteredMatches);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <MatchQueueFilters
                    queues={presentQueues}
                    selected={queueFilter}
                    onSelect={setQueueFilter}
                />

                {filteredMatches.length > 0 && (
                    <MatchSummaryBand summary={summary} version={version} catalogue={catalogue} />
                )}
            </div>

            {/*
                Built from queues actually present in the loaded matches, so this branch
                can only be reached if a refresh swaps in a different match history while
                a now-absent queue was still selected — a real case, still handled rather
                than left blank.
            */}
            {filteredMatches.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('profile.matches.filterEmpty')}</p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {filteredMatches.map((match) => (
                        <MatchCard
                            key={match.matchId}
                            match={match}
                            version={version}
                            catalogue={catalogue}
                            viewedPuuid={viewedPuuid}
                            lookup={lookup}
                            isExpanded={expandedMatchId === match.matchId}
                            onToggleExpand={() =>
                                setExpandedMatchId((current) =>
                                    current === match.matchId ? null : match.matchId,
                                )
                            }
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}
