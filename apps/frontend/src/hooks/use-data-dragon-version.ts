import { useQuery } from '@tanstack/react-query';

import { fetchLatestDataDragonVersion } from '../api/data-dragon';

export function useDataDragonVersion() {
    return useQuery({
        queryKey: ['data-dragon', 'version'],
        queryFn: fetchLatestDataDragonVersion,
        // A new version only ships with a game patch: once per visit is enough.
        staleTime: Infinity,
    });
}
