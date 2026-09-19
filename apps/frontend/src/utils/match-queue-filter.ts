import type { MatchSummary } from '@lynf/shared';

import { MATCH_QUEUE_NAMES } from '../constants/match-queues';

/** The translation key `MATCH_QUEUE_NAMES` falls back to for a queue id it does not name. */
const UNKNOWN_QUEUE_KEY = 'unknown';

/** The sentinel filter value that keeps every match, whatever queue it was played in. */
export const ALL_QUEUES = 'all';

/**
 * A queue filter is either every match (`ALL_QUEUES`) or one queue-name key from
 * `MATCH_QUEUE_NAMES` (`'unknown'` included) — never a raw Riot queue id. Riot has
 * shipped more than one numeric id for some queues (co-op vs. AI alone has three), and
 * a player has no reason to see several identical-looking pills that each only cover
 * part of those matches.
 */
export type QueueFilter = typeof ALL_QUEUES | string;

function queueKeyFor(match: MatchSummary): string {
    return MATCH_QUEUE_NAMES[match.queueId] ?? UNKNOWN_QUEUE_KEY;
}

/**
 * Every queue-name key actually present among the given matches, in the order each one
 * first appears. Matches already come most-recent-first, so this reads as "most
 * recently played queue first" — and, crucially, it is never Riot's full queue
 * catalogue: a pill for a queue this player has never touched would sit there empty.
 */
export function listPresentQueueFilters(matches: readonly MatchSummary[]): string[] {
    const seen = new Set<string>();

    for (const match of matches) {
        seen.add(queueKeyFor(match));
    }

    return [...seen];
}

/**
 * Filtering happens entirely on matches already in memory: it is browser-side state
 * over data TanStack Query already fetched, never a reason to call Riot or the server
 * again.
 */
export function filterMatchesByQueue(
    matches: readonly MatchSummary[],
    filter: QueueFilter,
): MatchSummary[] {
    if (filter === ALL_QUEUES) {
        return [...matches];
    }

    return matches.filter((match) => queueKeyFor(match) === filter);
}
