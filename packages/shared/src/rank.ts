/**
 * The two ranked queues Lynf shows. Riot returns entries for others — Arena among them —
 * and they are dropped: a profile page speaks about Summoner's Rift.
 */
export const ERankedQueue = {
    SOLO: 'RANKED_SOLO_5x5',
    FLEX: 'RANKED_FLEX_SR',
} as const;

export type ERankedQueue = (typeof ERankedQueue)[keyof typeof ERankedQueue];

export const RANKED_QUEUES = Object.values(ERankedQueue);

/**
 * One ranked standing, in one queue.
 *
 * `division` is Riot's `rank` field, renamed: `rank` alone reads as the whole standing,
 * and it is a reserved word in SQL. In the apex tiers — MASTER, GRANDMASTER, CHALLENGER —
 * Riot always answers `I`, and the interface does not show it.
 */
export type SummonerRank = {
    queue: ERankedQueue;
    /** `IRON` … `CHALLENGER`, as Riot spells it. */
    tier: string;
    /** `I`, `II`, `III` or `IV`. */
    division: string;
    leaguePoints: number;
    wins: number;
    losses: number;
};
