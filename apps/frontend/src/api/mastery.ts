import type { ChampionMastery, RiotIdLookup } from '@lynf/shared';

import { API_BASE_URL } from '../constants/api';
import { HttpError } from './http-error';

/** Talks to the back end and knows nothing about React. */
export async function fetchSummonerMasteries({
    region,
    gameName,
    tagLine,
}: RiotIdLookup): Promise<ChampionMastery[]> {
    const path = `/summoners/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/masteries`;
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    return (await response.json()) as ChampionMastery[];
}
