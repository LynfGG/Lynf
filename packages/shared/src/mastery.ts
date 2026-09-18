/**
 * How many champions a profile page shows. Riot's own default for the "top" endpoint
 * happens to match, but the number is pinned here rather than left to that default: a
 * change on Riot's side must never silently change what the page shows.
 */
export const TOP_CHAMPION_MASTERIES_COUNT = 3;

/**
 * One champion's mastery standing, as Riot's `champion-mastery-v4` reports it.
 *
 * Field names mirror Riot's own — `championId`, `championLevel`, `championPoints` — the
 * same choice made for ranked standings: only `rank` was renamed there, because it
 * collided with a reserved word, and nothing here does. `championId` is numeric, as
 * Riot returns it; matching it to a champion's name and portrait is Data Dragon's
 * catalogue, not this contract's job.
 */
export type ChampionMastery = {
    championId: number;
    championLevel: number;
    championPoints: number;
    /** When this champion was last played, as an ISO 8601 string. */
    lastPlayTime: string;
};
