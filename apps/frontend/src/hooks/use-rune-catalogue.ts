import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchRuneCatalogue } from '../api/rune-catalogue';
import { useDataDragonVersion } from './use-data-dragon-version';

/**
 * Data Dragon's rune catalogue, fetched once per Data Dragon version and shared by
 * every reader — never redone per rune, never redone per display. The same pattern as
 * `useChampionCatalogue`, since a rune id needs exactly the same one-time,
 * version-keyed lookup a champion id does.
 */
export function useRuneCatalogue() {
    const { data: version } = useDataDragonVersion();

    return useQuery({
        queryKey: ['data-dragon', 'runes', version],
        queryFn: version ? () => fetchRuneCatalogue(version) : skipToken,
        // A rune catalogue only changes with a game patch: once per visit is enough.
        staleTime: Infinity,
    });
}
