import type { MatchSummary, RiotIdLookup } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { useMatchTimeline } from '../../hooks/use-match-timeline';
import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import DuelBand from './duel-band';
import MatchDetailDuelChart from './match-detail-duel-chart';

type MatchDetailDuelProps = {
    match: MatchSummary;
    lookup: RiotIdLookup;
    language: string;
};

/**
 * The Duel tab: the existing lane-duel band on top, unchanged, then the
 * minute-by-minute gap chart below it — both read `match.opponent`, whoever held the
 * same lane on the other team.
 *
 * There is no lane to chart without an opponent — Arena among the queues that never
 * carry one — so the whole chart, and the timeline fetch it would need, is skipped in
 * favour of a plain sentence rather than requesting 755 KB this tab could not use.
 *
 * The timeline itself is only ever requested once this tab is actually mounted — see
 * `useMatchTimeline` — and is kept by TanStack Query for the rest of the session, so
 * leaving and reopening this tab for the same match never asks Riot again.
 */
export default function MatchDetailDuel({
    match,
    lookup,
    language,
}: Readonly<MatchDetailDuelProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const hasOpponent = match.opponent !== null;
    const {
        data: timeline,
        isPending,
        error,
    } = useMatchTimeline(lookup, match.matchId, hasOpponent);

    return (
        <div className="flex flex-col gap-5">
            <DuelBand player={match.player} opponent={match.opponent} language={language} />

            {!hasOpponent && (
                <p className="text-sm text-ink-muted">
                    {t('profile.matches.detail.duel.noOpponent')}
                </p>
            )}

            {hasOpponent && isPending && (
                <p className="text-sm text-ink-muted">
                    {t('profile.matches.detail.timeline.loading')}
                </p>
            )}

            {hasOpponent && error && (
                <p role="alert" className="text-sm text-loss">
                    {messageFor(error)}
                </p>
            )}

            {hasOpponent && timeline && match.opponent && (
                <MatchDetailDuelChart
                    frames={timeline.frames}
                    kills={timeline.kills}
                    player={match.player}
                    opponent={match.opponent}
                    language={language}
                />
            )}
        </div>
    );
}
