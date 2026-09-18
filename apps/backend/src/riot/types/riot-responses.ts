/** Shape of `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`. */
export type RiotAccountResponse = {
    puuid: string;
    gameName: string;
    tagLine: string;
};

/** Shape of `GET /lol/summoner/v4/summoners/by-puuid/{puuid}`. */
export type RiotSummonerResponse = {
    puuid: string;
    profileIconId: number;
    summonerLevel: number;
    revisionDate: number;
};

/** One entry of `GET /lol/league/v4/entries/by-puuid/{puuid}`. */
export type RiotLeagueEntryResponse = {
    queueType: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
};

/**
 * One entry of `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top`.
 *
 * `lastPlayTime` is epoch milliseconds, as Riot returns every timestamp on this API —
 * unlike `revisionDate` on `summoner-v4`, nothing here renames it.
 */
export type RiotChampionMasteryResponse = {
    championId: number;
    championLevel: number;
    championPoints: number;
    lastPlayTime: number;
};
