import { normalizeRiotId, type RiotIdLookup } from '@lynf/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchSummonerMasteries } from '../api/mastery';

export function summonerMasteriesQueryKey({ region, gameName, tagLine }: RiotIdLookup) {
    const normalized = normalizeRiotId(gameName, tagLine);
    return ['summoner-masteries', region, normalized.gameName, normalized.tagLine];
}

/** Nothing is requested until there is a player to look up. */
export function useSummonerMasteries(lookup: RiotIdLookup | undefined) {
    return useQuery({
        queryKey: lookup ? summonerMasteriesQueryKey(lookup) : ['summoner-masteries'],
        queryFn: lookup ? () => fetchSummonerMasteries(lookup) : skipToken,
        retry: false,
    });
}
