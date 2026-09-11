/**
 * Platforms a player can be looked up on — Riot's platform routing values.
 *
 * Riot routes requests through two layers: a *regional* cluster for account lookups and a
 * *platform* host for game data. Only the platform means something to a player, so it is
 * the only one that crosses the API boundary — the back end maps it to its cluster.
 */
export const EPlatformRegion = {
    EUW: 'euw1',
    EUNE: 'eun1',
    NA: 'na1',
    KR: 'kr',
    BR: 'br1',
    LAN: 'la1',
    LAS: 'la2',
    OCE: 'oc1',
    TR: 'tr1',
    RU: 'ru',
    JP: 'jp1',
    PH: 'ph2',
    SG: 'sg2',
    TH: 'th2',
    TW: 'tw2',
    VN: 'vn2',
} as const;

export type EPlatformRegion = (typeof EPlatformRegion)[keyof typeof EPlatformRegion];

export const PLATFORM_REGIONS = Object.values(EPlatformRegion);

/**
 * Length limits of a Riot ID (`gameName#tagLine`), as set by Riot. The form and the API
 * both validate against these, so the form never accepts what the API will refuse.
 */
export const RIOT_ID_LENGTH = {
    gameName: { min: 3, max: 16 },
    tagLine: { min: 3, max: 5 },
} as const;

/** What identifies a player to look up: a Riot ID, on one platform. */
export type RiotIdLookup = {
    region: EPlatformRegion;
    gameName: string;
    tagLine: string;
};

/** A player's public profile, as returned by `GET /summoners/:region/:gameName/:tagLine`. */
export type SummonerProfile = {
    puuid: string;
    gameName: string;
    tagLine: string;
    region: EPlatformRegion;
    profileIconId: number;
    summonerLevel: number;
    /** When this profile was last refreshed from Riot, as an ISO 8601 string. */
    updatedAt: string;
};
