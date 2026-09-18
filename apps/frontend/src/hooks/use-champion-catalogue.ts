import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchChampionCatalogue } from '../api/champion-catalogue';
import { useDataDragonVersion } from './use-data-dragon-version';

/**
 * Data Dragon's champion catalogue, fetched once per Data Dragon version and shared by
 * every reader — never redone per champion, never redone per display. Nothing is
 * requested until a version is known, since the catalogue is published per version.
 */
export function useChampionCatalogue() {
    const { data: version } = useDataDragonVersion();

    return useQuery({
        queryKey: ['data-dragon', 'champions', version],
        queryFn: version ? () => fetchChampionCatalogue(version) : skipToken,
        // A champion catalogue only changes with a game patch: once per visit is enough.
        staleTime: Infinity,
    });
}
