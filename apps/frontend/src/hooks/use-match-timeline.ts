import type { RiotIdLookup } from '@lynf/shared';
import { useQuery } from '@tanstack/react-query';

import { fetchMatchTimeline } from '../api/match-timeline';

/**
 * A match's timeline. Nothing is requested until `enabled` is `true` — the caller's job
 * is to pass that only once the Duel or Stuff tab has actually been opened for this
 * match, never before: this is the one gate the whole feature was authorised on.
 *
 * Keyed by `matchId` alone, never by the viewer's Riot ID: a finished match's timeline
 * is immutable and does not depend on whose profile it is opened from, so every tab
 * that ever opens the same match — even from two different profiles — shares one cache
 * entry. Combined with `staleTime: Infinity`, reopening a tab whose match was already
 * loaded never issues a second request.
 */
export function useMatchTimeline(lookup: RiotIdLookup, matchId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['match-timeline', matchId],
        queryFn: () => fetchMatchTimeline(lookup, matchId),
        enabled,
        staleTime: Infinity,
        retry: false,
    });
}
