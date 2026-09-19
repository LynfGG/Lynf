import type { RiotIdLookup } from '@lynf/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchSummonerMatches } from '../api/match';

export function summonerMatchesQueryKey({ region, gameName, tagLine }: RiotIdLookup) {
    return ['summoner-matches', region, gameName.toLowerCase(), tagLine.toLowerCase()];
}

/** Nothing is requested until there is a player to look up. */
export function useSummonerMatches(lookup: RiotIdLookup | undefined) {
    return useQuery({
        queryKey: lookup ? summonerMatchesQueryKey(lookup) : ['summoner-matches'],
        queryFn: lookup ? () => fetchSummonerMatches(lookup) : skipToken,
        retry: false,
    });
}
