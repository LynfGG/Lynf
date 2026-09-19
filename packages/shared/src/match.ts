/**
 * How many matches one refresh ever ingests. Riot is asked for exactly this many ids,
 * never more: loading "the whole history" is not something a rate-limited development
 * key can afford, and the ids returned are filtered against storage before any match
 * detail is fetched, so most refreshes cost far fewer calls than this ceiling.
 */
export const MATCH_HISTORY_LIMIT = 20;

/**
 * One participant of a match, in every place the match detail needs one: the tracked
 * player, their lane opponent, or any of the other players shown in the two-team
 * breakdown.
 *
 * `championId` is Riot's numeric id, matched to a portrait the same way champion
 * mastery already is: Data Dragon's catalogue, not this contract's job. `items` always
 * has seven entries, trinket included, in Riot's own slot order; an empty slot is `0`.
 * `teamPosition` is empty on some queues — arcade modes among them — and on matches old
 * enough to predate it; `riotIdGameName`/`riotIdTagline` are the name Riot reported for
 * this match, not a live lookup.
 */
export type MatchParticipantSummary = {
    puuid: string;
    riotIdGameName: string;
    riotIdTagline: string;
    teamId: number;
    teamPosition: string;
    championId: number;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    creepScore: number;
    goldEarned: number;
    totalDamageDealtToChampions: number;
    items: number[];
};

/**
 * One finished match, from the tracked player's point of view.
 *
 * `opponent` is whoever held the same `teamPosition` on the other team, when one could
 * be identified. `teamPosition` is empty on some queues — arcade modes among them — and
 * on matches old enough to predate it, and that is not an error: a match is never
 * hidden for lacking a duel, so `opponent` is simply `null` and the card falls back to
 * its plain form.
 *
 * `participants` is everyone in the match, the tracked player and their opponent
 * included — ten on Summoner's Rift, a different count on some other modes (Arena's
 * eighteen, for instance). It is what the expanded two-team breakdown is built from;
 * fetching it costs no extra Riot call, since `match-v5` already reports every
 * participant and the match history tranche already stored them all.
 */
export type MatchSummary = {
    matchId: string;
    /** Riot's numeric queue id, e.g. `420` for ranked solo/duo. */
    queueId: number;
    durationSeconds: number;
    /** When the match ended, as an ISO 8601 string. */
    endedAt: string;
    player: MatchParticipantSummary;
    opponent: MatchParticipantSummary | null;
    participants: MatchParticipantSummary[];
};
