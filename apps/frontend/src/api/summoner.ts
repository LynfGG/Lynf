import type { RiotIdLookup, SummonerProfile } from '@lynf/shared';

import { API_BASE_URL } from '../constants/api';
import { HttpError } from './http-error';

/**
 * Talks to the back end and knows nothing about React — testable on its own, and
 * usable outside a component.
 */
export async function fetchSummonerProfile({
    region,
    gameName,
    tagLine,
}: RiotIdLookup): Promise<SummonerProfile> {
    const path = `/summoners/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    return (await response.json()) as SummonerProfile;
}
