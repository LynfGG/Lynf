import { EPlatformRegion } from '@lynf/shared';

import { ERiotCluster } from '../enums/riot-cluster.enum';

/**
 * The cluster that serves account lookups (account-v1) for each platform.
 *
 * Callers only ever give a platform, so the mapping lives here. It is specific to
 * account-v1: other Riot APIs route differently — match-v5 has a fourth cluster, SEA —
 * so check an API's documentation before reusing this map for it.
 */
const ACCOUNT_CLUSTER_BY_PLATFORM: Record<EPlatformRegion, ERiotCluster> = {
    [EPlatformRegion.EUW]: ERiotCluster.EUROPE,
    [EPlatformRegion.EUNE]: ERiotCluster.EUROPE,
    [EPlatformRegion.TR]: ERiotCluster.EUROPE,
    [EPlatformRegion.RU]: ERiotCluster.EUROPE,
    [EPlatformRegion.NA]: ERiotCluster.AMERICAS,
    [EPlatformRegion.BR]: ERiotCluster.AMERICAS,
    [EPlatformRegion.LAN]: ERiotCluster.AMERICAS,
    [EPlatformRegion.LAS]: ERiotCluster.AMERICAS,
    [EPlatformRegion.KR]: ERiotCluster.ASIA,
    [EPlatformRegion.JP]: ERiotCluster.ASIA,
    [EPlatformRegion.OCE]: ERiotCluster.ASIA,
    [EPlatformRegion.PH]: ERiotCluster.ASIA,
    [EPlatformRegion.SG]: ERiotCluster.ASIA,
    [EPlatformRegion.TH]: ERiotCluster.ASIA,
    [EPlatformRegion.TW]: ERiotCluster.ASIA,
    [EPlatformRegion.VN]: ERiotCluster.ASIA,
};

export function accountClusterHost(region: EPlatformRegion) {
    return `https://${ACCOUNT_CLUSTER_BY_PLATFORM[region]}.api.riotgames.com`;
}

export function platformHost(region: EPlatformRegion) {
    return `https://${region}.api.riotgames.com`;
}
