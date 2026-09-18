/**
 * Riot's regional clusters.
 *
 * `SEA` serves match-v5 alone among the APIs Lynf calls: account-v1 routes every
 * platform SEA would otherwise carry — OCE, PH, SG, TH, TW, VN — through `ASIA`
 * instead. See `riot-routing.utils.ts` for the two separate maps this produces.
 */
export const ERiotCluster = {
    AMERICAS: 'americas',
    ASIA: 'asia',
    EUROPE: 'europe',
    SEA: 'sea',
} as const;

export type ERiotCluster = (typeof ERiotCluster)[keyof typeof ERiotCluster];
