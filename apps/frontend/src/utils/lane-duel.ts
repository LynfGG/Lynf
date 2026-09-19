import type { MatchParticipantSummary, MatchSummary } from '@lynf/shared';

/**
 * The three measures the expanded duel panel already shows, in that same order:
 * minions, gold, damage to champions. The headline "lane duels won" statistic is
 * judged on exactly these three and no others, so a sceptical player can expand any
 * match, read the same three bars, and check the verdict for themselves.
 */
export const LANE_DUEL_MEASURES = [
    'creepScore',
    'goldEarned',
    'totalDamageDealtToChampions',
] as const;

type LaneDuelMeasure = (typeof LANE_DUEL_MEASURES)[number];

/**
 * Strictly ahead only — a tie favours neither side. This is the one comparison every
 * lane-duel view is built from: the expanded panel's gap bars (`DuelBand`) call it once
 * per measure to decide which side to colour, and `wonLaneDuel` below calls it the same
 * way for the same three measures, so the summary statistic and the expanded panel can
 * never disagree about the same match.
 */
export function isAheadOnMeasure(playerValue: number, opponentValue: number): boolean {
    return playerValue > opponentValue;
}

const MEASURES_NEEDED_TO_WIN_A_DUEL = 2;

function countMeasuresAhead(
    player: MatchParticipantSummary,
    opponent: MatchParticipantSummary,
): number {
    return LANE_DUEL_MEASURES.filter((measure: LaneDuelMeasure) =>
        isAheadOnMeasure(player[measure], opponent[measure]),
    ).length;
}

/**
 * The product's headline verdict: the player wins the lane duel by being strictly ahead
 * of their direct opponent on at least two of the three measures above.
 */
export function wonLaneDuel(
    player: MatchParticipantSummary,
    opponent: MatchParticipantSummary,
): boolean {
    return countMeasuresAhead(player, opponent) >= MEASURES_NEEDED_TO_WIN_A_DUEL;
}

/**
 * The lane-duel verdict for one match, or `null` when the match has no identifiable
 * opponent — Riot's `teamPosition` empty, Arena among the queues that never carry one.
 * `null` is not a loss: it is the signal that this match must leave the lane-duel
 * denominator entirely, since no duel could be judged in the first place.
 */
export function laneDuelResult(match: MatchSummary): boolean | null {
    return match.opponent ? wonLaneDuel(match.player, match.opponent) : null;
}
