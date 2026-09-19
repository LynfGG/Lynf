import type { MatchParticipantSummary, MatchSummary, RiotIdLookup } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { MATCH_QUEUE_NAMES } from '../../constants/match-queues';
import type { ChampionCatalogue } from '../../api/champion-catalogue';
import {
    formatMatchDuration,
    formatRelativeTime,
    formatSignedNumber,
} from '../../utils/match-format';
import ChampionPortrait from '../ui/champion-portrait';
import ItemRow from '../ui/item-row';
import MatchDetails from './match-details';

const PLAYER_PORTRAIT_SIZE = 48;
const OPPONENT_PORTRAIT_SIZE = 36;

type MatchCardProps = {
    match: MatchSummary;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
    viewedPuuid: string;
    lookup: RiotIdLookup;
    isExpanded: boolean;
    onToggleExpand: () => void;
};

function DiffBadge({ value, label }: Readonly<{ value: number; label: string }>) {
    const tone = value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-ink-muted';

    return <span className={tone}>{label}</span>;
}

/**
 * One finished match, in the "Duel" mockup's short form: the champion played, the
 * score, the queue, the duration, how long ago, the result, and — when an opponent at
 * the same position could be identified — the duel column.
 *
 * `match.opponent` is `null` whenever Riot's own `teamPosition` was empty for this
 * match, or no one on the other team shared it: an arcade queue, or a match old enough
 * to predate the field. That is never a reason to hide the match itself — only the
 * duel column is missing, and the row still reads on its own.
 */
export default function MatchCard({
    match,
    version,
    catalogue,
    viewedPuuid,
    lookup,
    isExpanded,
    onToggleExpand,
}: Readonly<MatchCardProps>) {
    const { t, i18n } = useTranslation('summoner');

    const queueKey = MATCH_QUEUE_NAMES[match.queueId];
    const queueLabel = queueKey
        ? t(`profile.matches.queue.${queueKey}`)
        : t('profile.matches.queue.unknown');

    const resultTone = match.player.win ? 'border-win' : 'border-loss';
    const resultLabel = t(
        match.player.win ? 'profile.matches.result.win' : 'profile.matches.result.loss',
    );

    const kda = (participant: MatchParticipantSummary) =>
        t('profile.matches.kda', {
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
        });

    const relativeTime = formatRelativeTime(match.endedAt, i18n.language);
    const championName =
        catalogue?.get(match.player.championId)?.name ??
        t('profile.matches.unknownChampion', { id: match.player.championId });
    const detailsId = `match-details-${match.matchId}`;
    const toggleLabel = t(
        isExpanded ? 'profile.matches.hideDetails' : 'profile.matches.viewDetails',
        { champion: championName, result: resultLabel, time: relativeTime },
    );

    return (
        <li
            className={`flex flex-col gap-3 rounded-xl border border-line border-l-4 bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 ${resultTone}`}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <ChampionPortrait
                    championId={match.player.championId}
                    size={PLAYER_PORTRAIT_SIZE}
                    version={version}
                    catalogue={catalogue}
                />

                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                        <span
                            className={
                                match.player.win
                                    ? 'font-semibold text-win'
                                    : 'font-semibold text-loss'
                            }
                        >
                            {resultLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{queueLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatMatchDuration(match.durationSeconds)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{relativeTime}</span>
                    </div>

                    <span className="text-sm font-semibold text-ink">{kda(match.player)}</span>

                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <span>
                            {t('profile.matches.creepScore', { count: match.player.creepScore })}
                        </span>
                        <ItemRow items={match.player.items} version={version} />
                    </div>
                </div>
            </div>

            {match.opponent && (
                <div className="flex items-center gap-3 border-t border-line pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                    <span className="text-[11px] font-semibold text-ink-muted uppercase">
                        {t('profile.matches.vs')}
                    </span>

                    <ChampionPortrait
                        championId={match.opponent.championId}
                        size={OPPONENT_PORTRAIT_SIZE}
                        version={version}
                        catalogue={catalogue}
                    />

                    <div className="flex flex-col gap-0.5 text-xs">
                        <span className="text-ink-muted">{kda(match.opponent)}</span>
                        <DiffBadge
                            value={match.player.creepScore - match.opponent.creepScore}
                            label={t('profile.matches.creepScoreDiff', {
                                value: formatSignedNumber(
                                    match.player.creepScore - match.opponent.creepScore,
                                    i18n.language,
                                ),
                            })}
                        />
                        <DiffBadge
                            value={match.player.goldEarned - match.opponent.goldEarned}
                            label={t('profile.matches.goldDiff', {
                                value: formatSignedNumber(
                                    match.player.goldEarned - match.opponent.goldEarned,
                                    i18n.language,
                                ),
                            })}
                        />
                    </div>
                </div>
            )}

            <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                aria-label={toggleLabel}
                onClick={onToggleExpand}
                className="shrink-0 self-center text-lg text-ink-muted transition-colors hover:text-ink"
            >
                <span aria-hidden="true" className={isExpanded ? 'inline-block rotate-90' : ''}>
                    ›
                </span>
            </button>

            {/*
                The panel keeps its id and `hidden` attribute regardless of expansion, so
                `aria-controls` above always points at a real element and the disclosure
                keeps announcing and behaving the same way to assistive tech and the
                keyboard. Only its content is mounted on demand: an `<img>` still loads
                even while hidden, and mounting twenty detail panels — each with its own
                portraits and item icons — on every profile view was firing roughly two
                hundred image requests for panels nobody had opened.
            */}
            <div id={detailsId} hidden={!isExpanded} className="basis-full">
                {isExpanded && (
                    <MatchDetails
                        match={match}
                        version={version}
                        catalogue={catalogue}
                        viewedPuuid={viewedPuuid}
                        lookup={lookup}
                    />
                )}
            </div>
        </li>
    );
}
