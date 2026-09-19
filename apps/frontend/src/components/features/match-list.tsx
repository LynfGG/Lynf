import type { MatchSummary } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import { useChampionCatalogue } from '../../hooks/use-champion-catalogue';
import { useDataDragonVersion } from '../../hooks/use-data-dragon-version';
import MatchCard from './match-card';

type MatchListProps = {
    matches: MatchSummary[] | undefined;
    isPending: boolean;
    error: Error | null;
};

/**
 * The match history section of a profile — tranche 3 of the "Duel" mockup: the list
 * alone, each row already carrying the duel column when one could be identified. The
 * ten-player breakdown behind each row's disabled details button is a later tranche.
 */
export default function MatchList({ matches, isPending, error }: Readonly<MatchListProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { data: version } = useDataDragonVersion();
    const { data: catalogue } = useChampionCatalogue();

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
                />
            ))}
        </ul>
    );
}
