import type { MatchTimeline, RiotIdLookup } from '@lynf/shared';

import { API_BASE_URL } from '../constants/api';
import { HttpError } from './http-error';

/**
 * Talks to the back end and knows nothing about React.
 *
 * This is the one call the whole feature was authorised on the condition of never
 * firing eagerly: it must only ever be triggered by `useMatchTimeline` with `enabled`
 * set to `true`, itself only reachable once the Duel or Stuff tab has actually been
 * opened for this match.
 */
export async function fetchMatchTimeline(
    { region, gameName, tagLine }: RiotIdLookup,
    matchId: string,
): Promise<MatchTimeline> {
    const path = `/summoners/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/matches/${encodeURIComponent(matchId)}/timeline`;
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    return (await response.json()) as MatchTimeline;
}
