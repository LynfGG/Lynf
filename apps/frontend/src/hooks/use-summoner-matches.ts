import { normalizeRiotId, type RiotIdLookup } from '@lynf/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchSummonerMatches } from '../api/match';

export function summonerMatchesQueryKey({ region, gameName, tagLine }: RiotIdLookup) {
    const normalized = normalizeRiotId(gameName, tagLine);
    return ['summoner-matches', region, normalized.gameName, normalized.tagLine];
}

/** Nothing is requested until there is a player to look up. */
export function useSummonerMatches(lookup: RiotIdLookup | undefined) {
    return useQuery({
        queryKey: lookup ? summonerMatchesQueryKey(lookup) : ['summoner-matches'],
        queryFn: lookup ? () => fetchSummonerMatches(lookup) : skipToken,
        retry: false,
    });
}
