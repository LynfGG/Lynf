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

/**
 * The cluster that serves match-v5 for each platform.
 *
 * This is the map the account-v1 one above warns not to reuse, verified against Riot's
 * own routing changes rather than assumed: OCE moved from `AMERICAS` to `SEA` in mid-2022,
 * and PH, SG, TH and TW joined `SEA` from `ASIA` in January 2023 when Riot took over
 * publishing in Southeast Asia. Every one of those six platforms is still routed to
 * `ASIA` by account-v1's map above — the exact discrepancy this map exists to avoid.
 */
const MATCH_CLUSTER_BY_PLATFORM: Record<EPlatformRegion, ERiotCluster> = {
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
    [EPlatformRegion.OCE]: ERiotCluster.SEA,
    [EPlatformRegion.PH]: ERiotCluster.SEA,
    [EPlatformRegion.SG]: ERiotCluster.SEA,
    [EPlatformRegion.TH]: ERiotCluster.SEA,
    [EPlatformRegion.TW]: ERiotCluster.SEA,
    [EPlatformRegion.VN]: ERiotCluster.SEA,
};

export function matchClusterHost(region: EPlatformRegion) {
    return `https://${MATCH_CLUSTER_BY_PLATFORM[region]}.api.riotgames.com`;
}
