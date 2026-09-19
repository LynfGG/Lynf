import type { MatchSummary } from '@lynf/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import { useChampionCatalogue } from '../../hooks/use-champion-catalogue';
import { useDataDragonVersion } from '../../hooks/use-data-dragon-version';
import MatchCard from './match-card';

type MatchListProps = {
    matches: MatchSummary[] | undefined;
    isPending: boolean;
    error: Error | null;
    /** The puuid of the profile this page is showing, to highlight it in a team breakdown. */
    viewedPuuid: string;
};

/**
 * The match history section of a profile — the "Duel" mockup's identity feature: each
 * row carries its duel column when one could be identified, and can be expanded in
 * place for the lane duel and the full two-team breakdown. Only one match is ever open
 * at a time, so opening a second closes whichever was open before it.
 */
export default function MatchList({
    matches,
    isPending,
    error,
    viewedPuuid,
}: Readonly<MatchListProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { data: version } = useDataDragonVersion();
    const { data: catalogue } = useChampionCatalogue();
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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

    return (
        <ul className="flex flex-col gap-2">
            {matches.map((match) => (
                <MatchCard
                    key={match.matchId}
                    match={match}
                    version={version}
                    catalogue={catalogue}
                    viewedPuuid={viewedPuuid}
                    isExpanded={expandedMatchId === match.matchId}
                    onToggleExpand={() =>
                        setExpandedMatchId((current) =>
                            current === match.matchId ? null : match.matchId,
                        )
                    }
                />
            ))}
        </ul>
    );
}
