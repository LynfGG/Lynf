import { normalizeRiotId, type RiotIdLookup } from '@lynf/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchSummonerProfile } from '../api/summoner';

/** Riot IDs are case-insensitive, so `Faker#KR1` and `faker#kr1` share one cache entry. */
export function summonerProfileQueryKey({ region, gameName, tagLine }: RiotIdLookup) {
    const normalized = normalizeRiotId(gameName, tagLine);
    return ['summoner', region, normalized.gameName, normalized.tagLine];
}

/**
 * TanStack Query owns this data. Never copy what it returns into local state —
 * that reintroduces every synchronisation bug the library exists to remove.
 *
 * Nothing is requested until there is a player to look up.
 */
export function useSummonerProfile(lookup: RiotIdLookup | undefined) {
    return useQuery({
        queryKey: lookup ? summonerProfileQueryKey(lookup) : ['summoner'],
        queryFn: lookup ? () => fetchSummonerProfile(lookup) : skipToken,
        retry: false,
    });
}
