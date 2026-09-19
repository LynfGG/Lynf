import type { MatchSummary, RiotIdLookup } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { useMatchTimeline } from '../../hooks/use-match-timeline';
import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import MatchDetailItemOrder from './match-detail-item-order';
import MatchDetailRunes from './match-detail-runes';
import MatchDetailSkillOrder from './match-detail-skill-order';

type MatchDetailStuffProps = {
    match: MatchSummary;
    lookup: RiotIdLookup;
    version: string | undefined;
};

/**
 * The Stuff tab: runes, then skill order, then item order — in that order, per the
 * brief. Runes come straight from `match.player`, already stored at match ingestion, no
 * fetch involved; skill order and item order are both built from the match timeline,
 * fetched only once this tab is actually mounted — see `useMatchTimeline` — and never
 * again afterwards for the same match.
 *
 * A failed timeline fetch is reported here without touching the runes block above it:
 * runes never depended on the timeline in the first place.
 */
export default function MatchDetailStuff({
    match,
    lookup,
    version,
}: Readonly<MatchDetailStuffProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { data: timeline, isPending, error } = useMatchTimeline(lookup, match.matchId, true);

    return (
        <div className="flex flex-col gap-6">
            <MatchDetailRunes runes={match.player.runes} />

            {isPending && (
                <p className="text-sm text-ink-muted">
                    {t('profile.matches.detail.timeline.loading')}
                </p>
            )}

            {error && (
                <p role="alert" className="text-sm text-loss">
                    {messageFor(error)}
                </p>
            )}

            {timeline && (
                <>
                    <MatchDetailSkillOrder
                        skillLevelUps={timeline.skillLevelUps}
                        puuid={match.player.puuid}
                    />

                    <MatchDetailItemOrder
                        itemEvents={timeline.itemEvents}
                        puuid={match.player.puuid}
                        version={version}
                    />
                </>
            )}
        </div>
    );
}
