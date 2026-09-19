import type { MatchSummary } from '@lynf/shared';

import { laneDuelResult } from './lane-duel';

const TOP_CHAMPIONS_LIMIT = 3;
const ONE_DECIMAL = 10;

export type MatchesSummary = {
    /**
     * `null` when none of the given matches had an identifiable opponent to duel — the
     * one case where the statistic must not display at all, rather than announce a
     * false "0 / 0".
     */
    laneDuels: { won: number; eligible: number } | null;
    wins: number;
    losses: number;
    averageKda: { kills: number; deaths: number; assists: number };
    /** Highest game count first; ties keep the most-recently-played order, since
     * matches arrive most-recent-first and `Map` iteration order is insertion order. */
    topChampions: { championId: number; games: number }[];
};

function roundToOneDecimal(value: number): number {
    return Math.round(value * ONE_DECIMAL) / ONE_DECIMAL;
}

function average(total: number, count: number): number {
    return count === 0 ? 0 : roundToOneDecimal(total / count);
}

/**
 * Everything the summary band shows, recomputed from whatever slice of matches is
 * currently on screen — filtered by queue or not, this is the only place that
 * aggregates them, so the band can never drift from the list right below it.
 *
 * A match with no identifiable opponent still counts toward the record and the KDA
 * average like any other match — Arena is a real, played match, it simply has no lane
 * to duel in. It only ever leaves the lane-duel denominator, per `laneDuelResult`.
 */
export function summarizeMatches(matches: readonly MatchSummary[]): MatchesSummary {
    let laneDuelsWon = 0;
    let laneDuelsEligible = 0;
    let wins = 0;
    let losses = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    const gamesByChampion = new Map<number, number>();

    for (const match of matches) {
        const duelResult = laneDuelResult(match);

        if (duelResult !== null) {
            laneDuelsEligible += 1;

            if (duelResult) {
                laneDuelsWon += 1;
            }
        }

        if (match.player.win) {
            wins += 1;
        } else {
            losses += 1;
        }

        totalKills += match.player.kills;
        totalDeaths += match.player.deaths;
        totalAssists += match.player.assists;

        gamesByChampion.set(
            match.player.championId,
            (gamesByChampion.get(match.player.championId) ?? 0) + 1,
        );
    }

    const topChampions = [...gamesByChampion.entries()]
        .sort(([, gamesA], [, gamesB]) => gamesB - gamesA)
        .slice(0, TOP_CHAMPIONS_LIMIT)
        .map(([championId, games]) => ({ championId, games }));

    return {
        laneDuels:
            laneDuelsEligible === 0 ? null : { won: laneDuelsWon, eligible: laneDuelsEligible },
        wins,
        losses,
        averageKda: {
            kills: average(totalKills, matches.length),
            deaths: average(totalDeaths, matches.length),
            assists: average(totalAssists, matches.length),
        },
        topChampions,
    };
}
