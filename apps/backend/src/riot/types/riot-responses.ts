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
