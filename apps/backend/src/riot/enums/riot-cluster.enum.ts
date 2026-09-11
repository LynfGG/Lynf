/** Riot's regional clusters. */
export const ERiotCluster = {
    AMERICAS: 'americas',
    ASIA: 'asia',
    EUROPE: 'europe',
} as const;

export type ERiotCluster = (typeof ERiotCluster)[keyof typeof ERiotCluster];
