import type { RiotIdLookup } from '@lynf/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchSummonerRanks } from '../api/rank';

export function summonerRanksQueryKey({ region, gameName, tagLine }: RiotIdLookup) {
    return ['summoner-ranks', region, gameName.toLowerCase(), tagLine.toLowerCase()];
}

/** Nothing is requested until there is a player to look up. */
export function useSummonerRanks(lookup: RiotIdLookup | undefined) {
    return useQuery({
        queryKey: lookup ? summonerRanksQueryKey(lookup) : ['summoner-ranks'],
        queryFn: lookup ? () => fetchSummonerRanks(lookup) : skipToken,
        retry: false,
    });
}
