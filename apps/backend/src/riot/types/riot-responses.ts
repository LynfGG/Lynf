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

/**
 * One participant's runes (`info.participants[].perks`), verified live on 2026-09-19:
 * two styles (`primaryStyle`/`subStyle`, each with its own `selections`) and three
 * stat-shard fragments. Only numeric ids are read here — naming and imagery are the
 * screen's job.
 */
export type RiotMatchParticipantPerksResponse = {
    statPerks: {
        offense: number;
        flex: number;
        defense: number;
    };
    styles: {
        /** `'primaryStyle'` or `'subStyle'` — read by value, never assumed to be an index. */
        description: string;
        style: number;
        selections: { perk: number }[];
    }[];
};

/**
 * One participant of `GET /lol/match/v5/matches/{matchId}` (`info.participants`).
 *
 * Only the fields Lynf's match list needs are declared — Riot's real payload carries
 * many more. `teamPosition` is empty on some queues (arcade modes among them) and on
 * matches old enough to predate it: never assumed non-empty. `riotIdGameName` and
 * `riotIdTagline` are the modern Riot ID fields; `summonerName` is Riot's own
 * deprecated one and is not read here.
 */
export type RiotMatchParticipantResponse = {
    puuid: string;
    championId: number;
    teamId: number;
    teamPosition: string;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    goldEarned: number;
    totalDamageDealtToChampions: number;
    riotIdGameName: string;
    riotIdTagline: string;
    item0: number;
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number;
    perks: RiotMatchParticipantPerksResponse;
};

/**
 * Shape of `GET /lol/match/v5/matches/{matchId}`, trimmed to what Lynf reads.
 *
 * `info.gameDuration` is seconds for every match with a `gameEndTimestamp` — true of
 * every match this app ever fetches, since Riot only backfilled that field from patch
 * 11.20 (October 2021) onward, long before any match a development key can reach.
 */
export type RiotMatchResponse = {
    metadata: {
        matchId: string;
    };
    info: {
        platformId: string;
        queueId: number;
        gameDuration: number;
        gameEndTimestamp: number;
        gameVersion: string;
        participants: RiotMatchParticipantResponse[];
    };
};

/**
 * One participant's snapshot inside one timeline frame
 * (`info.frames[].participantFrames`, keyed by `participantId` as a string). Only the
 * per-minute figures the timeline tabs chart are declared — Riot's real payload also
 * carries live champion stats and damage breakdowns, discarded at extraction.
 *
 * There is no per-minute damage here, because `match-v5`'s timeline does not report
 * one: verified live on 2026-09-19, not assumed.
 */
export type RiotMatchTimelineParticipantFrameResponse = {
    totalGold: number;
    minionsKilled: number;
    jungleMinionsKilled: number;
    xp: number;
    level: number;
};

/**
 * One event inside one timeline frame (`info.frames[].events`). Riot reports many more
 * event types than this; only the fields the five kept types actually use are declared,
 * all of them optional since no single event type carries all of them.
 *
 * `ITEM_UNDO`'s `beforeId`/`afterId` describe what is being reversed: `beforeId` is the
 * item being un-bought (an undone purchase), `afterId` is the item being un-sold (an
 * undone sale) — `0` means "nothing" on whichever side does not apply. Verified against
 * a real match containing both cases.
 */
export type RiotMatchTimelineEventResponse = {
    type: string;
    timestamp: number;
    participantId?: number;
    itemId?: number;
    skillSlot?: number;
    killerId?: number;
    victimId?: number;
    assistingParticipantIds?: number[];
    beforeId?: number;
    afterId?: number;
};

export type RiotMatchTimelineFrameResponse = {
    participantFrames: Record<string, RiotMatchTimelineParticipantFrameResponse>;
    events: RiotMatchTimelineEventResponse[];
};

/**
 * Shape of `GET /lol/match/v5/matches/{matchId}/timeline`, trimmed to what Lynf
 * extracts. Verified live on 2026-09-19 against a 28-minute EUW match: 755 KB, one
 * frame per minute.
 *
 * `info.participants` is the only place this response ties a frame's or event's
 * `participantId` (a per-match index, 1 to 10) back to a `puuid` — the id every other
 * table in this schema is keyed by. Extraction reads it once and maps every
 * `participantId` through it.
 */
export type RiotMatchTimelineResponse = {
    metadata: {
        matchId: string;
    };
    info: {
        participants: { participantId: number; puuid: string }[];
        frames: RiotMatchTimelineFrameResponse[];
    };
};
