import type { RiotIdLookup, SummonerRank } from '@lynf/shared';

import { API_BASE_URL } from '../constants/api';
import { HttpError } from './http-error';

/** Talks to the back end and knows nothing about React. */
export async function fetchSummonerRanks({
    region,
    gameName,
    tagLine,
}: RiotIdLookup): Promise<SummonerRank[]> {
    const path = `/summoners/${region}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/ranks`;
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    return (await response.json()) as SummonerRank[];
}
