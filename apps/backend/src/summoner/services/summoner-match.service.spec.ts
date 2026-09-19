import { EPlatformRegion, MATCH_HISTORY_LIMIT } from '@lynf/shared';
import {
    BadGatewayException,
    HttpException,
    HttpStatus,
    Logger,
    NotFoundException,
} from '@nestjs/common';

import type { Environment } from '../../config/environment';
import type { MatchParticipantRow, MatchRow } from '../../database/schema';
import type { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotMatchResponse } from '../../riot/types/riot-responses';
import type { MatchRepository, MatchWithPlayerRow } from '../repositories/match.repository';
import { SummonerMatchService } from './summoner-match.service';
import type { SummonerService } from './summoner.service';

const TTL_SECONDS = 300;
const ENVIRONMENT = { SUMMONER_MATCHES_TTL_SECONDS: TTL_SECONDS } as Environment;
const LOOKUP = { region: EPlatformRegion.EUW, gameName: 'faker', tagLine: 'kr1' };
const PUUID = 'p-1';
const OPPONENT_PUUID = 'p-2';

/** What `SummonerService.resolvePlayer` yields — the single, shared resolution. */
const RESOLVED = { puuid: PUUID, gameName: 'Faker', tagLine: 'KR1' };

function readSecondsAgo(seconds: number) {
    return new Date(Date.now() - seconds * 1000);
}

const ENDED_AT = new Date('2026-09-18T10:00:00.000Z');

function matchRow(overrides: Partial<MatchRow> = {}): MatchRow {
    return {
        matchId: 'EUW1_1',
        platformId: 'EUW1',
        queueId: 420,
        durationSeconds: 1800,
        endedAt: ENDED_AT,
        gameVersion: '14.18.1',
        ...overrides,
    };
}

function participantRow(overrides: Partial<MatchParticipantRow> = {}): MatchParticipantRow {
    return {
        matchId: 'EUW1_1',
        puuid: PUUID,
        teamId: 100,
        championId: 103,
        teamPosition: 'MIDDLE',
        win: true,
        kills: 5,
        deaths: 2,
        assists: 7,
        creepScore: 180,
        goldEarned: 12_000,
        totalDamageDealtToChampions: 20_000,
        items: [1001, 0, 0, 0, 0, 0, 3340],
        riotIdGameName: 'Faker',
        riotIdTagline: 'KR1',
        ...overrides,
    };
}

function rawMatch(matchId: string): RiotMatchResponse {
    return {
        metadata: { matchId },
        info: {
            platformId: 'EUW1',
            queueId: 420,
            gameDuration: 1800,
            gameEndTimestamp: ENDED_AT.getTime(),
            gameVersion: '14.18.1',
            participants: [
                {
                    puuid: PUUID,
                    championId: 103,
                    teamId: 100,
                    teamPosition: 'MIDDLE',
                    win: true,
                    kills: 5,
                    deaths: 2,
                    assists: 7,
                    totalMinionsKilled: 160,
                    neutralMinionsKilled: 20,
                    goldEarned: 12_000,
                    totalDamageDealtToChampions: 20_000,
                    riotIdGameName: 'Faker',
                    riotIdTagline: 'KR1',
                    item0: 1001,
                    item1: 0,
                    item2: 0,
                    item3: 0,
                    item4: 0,
                    item5: 0,
                    item6: 3340,
                },
                {
                    puuid: OPPONENT_PUUID,
                    championId: 238,
                    teamId: 200,
                    teamPosition: 'MIDDLE',
                    win: false,
                    kills: 1,
                    deaths: 6,
                    assists: 2,
                    totalMinionsKilled: 100,
                    neutralMinionsKilled: 0,
                    goldEarned: 8_000,
                    totalDamageDealtToChampions: 9_000,
                    riotIdGameName: 'Rival',
                    riotIdTagline: 'EUW',
                    item0: 0,
                    item1: 0,
                    item2: 0,
                    item3: 0,
                    item4: 0,
                    item5: 0,
                    item6: 3340,
                },
            ],
        },
    };
}

describe('SummonerMatchService', () => {
    let summoners: jest.Mocked<Pick<SummonerService, 'resolvePlayer'>>;
    let repository: jest.Mocked<
        Pick<
            MatchRepository,
            | 'findReadAt'
            | 'markListRead'
            | 'findExistingMatchIds'
            | 'insertMatch'
            | 'findRecentByPuuid'
            | 'findParticipantsByMatchIds'
        >
    >;
    let riot: jest.Mocked<Pick<RiotExternal, 'getMatchIdsByPuuid' | 'getMatchById'>>;
    let service: SummonerMatchService;
    let warnLog: jest.SpyInstance;

    beforeEach(() => {
        summoners = { resolvePlayer: jest.fn() };
        repository = {
            findReadAt: jest.fn(),
            markListRead: jest.fn(),
            findExistingMatchIds: jest.fn(),
            insertMatch: jest.fn(),
            findRecentByPuuid: jest.fn(),
            findParticipantsByMatchIds: jest.fn(),
        };
        riot = { getMatchIdsByPuuid: jest.fn(), getMatchById: jest.fn() };
        service = new SummonerMatchService(
            summoners as unknown as SummonerService,
            repository as unknown as MatchRepository,
            riot as unknown as RiotExternal,
            ENVIRONMENT,
        );

        // Player resolution itself — storage-first, deduped, falling back to Riot — is
        // SummonerService's job and is tested there; this service only needs to trust
        // whatever identity it is handed.
        summoners.resolvePlayer.mockResolvedValue(RESOLVED);
        repository.findReadAt.mockResolvedValue(null);
        repository.findExistingMatchIds.mockResolvedValue(new Set());
        repository.insertMatch.mockResolvedValue(undefined);
        repository.markListRead.mockResolvedValue(undefined);
        repository.findRecentByPuuid.mockResolvedValue([]);
        repository.findParticipantsByMatchIds.mockResolvedValue([]);
        riot.getMatchIdsByPuuid.mockResolvedValue([]);

        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    describe('player resolution', () => {
        it('resolves the player through the single shared resolution before reading matches', async () => {
            await service.findByRiotId(LOOKUP);

            expect(summoners.resolvePlayer).toHaveBeenCalledWith(LOOKUP);
            expect(repository.findReadAt).toHaveBeenCalledWith(PUUID, EPlatformRegion.EUW);
        });

        it('lets a missing player through as a 404', async () => {
            summoners.resolvePlayer.mockRejectedValue(new NotFoundException());

            await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('the id-list call and its bound', () => {
        it('asks for at most MATCH_HISTORY_LIMIT ids', async () => {
            await service.findByRiotId(LOOKUP);

            expect(riot.getMatchIdsByPuuid).toHaveBeenCalledWith(
                PUUID,
                EPlatformRegion.EUW,
                MATCH_HISTORY_LIMIT,
            );
        });

        it('dates the list read once the id list has been fetched', async () => {
            await service.findByRiotId(LOOKUP);

            expect(repository.markListRead).toHaveBeenCalledWith(
                PUUID,
                EPlatformRegion.EUW,
                expect.any(Date),
            );
        });

        it('serves what is stored while the list is fresh, without calling Riot at all', async () => {
            repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS - 1));

            await service.findByRiotId(LOOKUP);

            expect(riot.getMatchIdsByPuuid).not.toHaveBeenCalled();
            expect(riot.getMatchById).not.toHaveBeenCalled();
        });

        it('asks Riot again once the list is stale', async () => {
            repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));

            await service.findByRiotId(LOOKUP);

            expect(riot.getMatchIdsByPuuid).toHaveBeenCalled();
        });

        it('treats a list read exactly at the TTL as stale', async () => {
            repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS));

            await service.findByRiotId(LOOKUP);

            expect(riot.getMatchIdsByPuuid).toHaveBeenCalled();
        });
    });

    describe('ingesting only what is unknown', () => {
        it('never fetches a match detail for an id already stored', async () => {
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1', 'EUW1_2']);
            repository.findExistingMatchIds.mockResolvedValue(new Set(['EUW1_1', 'EUW1_2']));

            await service.findByRiotId(LOOKUP);

            expect(repository.findExistingMatchIds).toHaveBeenCalledWith(['EUW1_1', 'EUW1_2']);
            expect(riot.getMatchById).not.toHaveBeenCalled();
        });

        it('fetches exactly the ids not already stored, and stores each one', async () => {
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1', 'EUW1_2', 'EUW1_3']);
            repository.findExistingMatchIds.mockResolvedValue(new Set(['EUW1_2']));
            riot.getMatchById.mockImplementation((matchId) =>
                Promise.resolve(rawMatch(matchId as string)),
            );

            await service.findByRiotId(LOOKUP);

            expect(riot.getMatchById).toHaveBeenCalledTimes(2);
            expect(riot.getMatchById).toHaveBeenCalledWith('EUW1_1', EPlatformRegion.EUW);
            expect(riot.getMatchById).toHaveBeenCalledWith('EUW1_3', EPlatformRegion.EUW);
            expect(repository.insertMatch).toHaveBeenCalledTimes(2);
        });

        it('costs exactly one list call plus one call per unknown match', async () => {
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1', 'EUW1_2']);
            repository.findExistingMatchIds.mockResolvedValue(new Set());
            riot.getMatchById.mockImplementation((matchId) =>
                Promise.resolve(rawMatch(matchId as string)),
            );

            await service.findByRiotId(LOOKUP);

            expect(riot.getMatchIdsByPuuid).toHaveBeenCalledTimes(1);
            expect(riot.getMatchById).toHaveBeenCalledTimes(2);
        });

        it('maps items, creep score and match metadata from the raw Riot response', async () => {
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1']);
            riot.getMatchById.mockResolvedValue(rawMatch('EUW1_1'));

            await service.findByRiotId(LOOKUP);

            expect(repository.insertMatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    matchId: 'EUW1_1',
                    platformId: 'EUW1',
                    queueId: 420,
                    durationSeconds: 1800,
                    endedAt: ENDED_AT,
                    gameVersion: '14.18.1',
                }),
                [
                    expect.objectContaining({
                        puuid: PUUID,
                        championId: 103,
                        teamPosition: 'MIDDLE',
                        creepScore: 180,
                        items: [1001, 0, 0, 0, 0, 0, 3340],
                    }),
                    expect.objectContaining({
                        puuid: OPPONENT_PUUID,
                        championId: 238,
                        creepScore: 100,
                    }),
                ],
            );
        });

        it('stops ingestion after a rate limit, without losing what was already fetched, and leaves the list undated', async () => {
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1', 'EUW1_2', 'EUW1_3']);
            riot.getMatchById
                .mockResolvedValueOnce(rawMatch('EUW1_1'))
                .mockRejectedValueOnce(
                    new HttpException('rate limited', HttpStatus.TOO_MANY_REQUESTS),
                )
                .mockResolvedValueOnce(rawMatch('EUW1_3'));

            await expect(service.findByRiotId(LOOKUP)).resolves.toBeDefined();

            expect(repository.insertMatch).toHaveBeenCalledTimes(1);
            expect(repository.insertMatch).toHaveBeenCalledWith(
                expect.objectContaining({ matchId: 'EUW1_1' }),
                expect.anything(),
            );
            // The third match is never even attempted once the loop stops.
            expect(riot.getMatchById).toHaveBeenCalledTimes(2);
            // The list is deliberately left undated: ingestion did not run to
            // completion, so the next view retries the remainder right away instead of
            // waiting out the freshness window on an incomplete answer.
            expect(repository.markListRead).not.toHaveBeenCalled();
            expect(warnLog).toHaveBeenCalledWith(expect.stringContaining('EUW1_2'));
        });

        it('does not date the list, and does not report an empty history, when every match fetch is rate limited on a never-seen player', async () => {
            // The scenario the whole-branch review flagged: a player never seen before,
            // whose very first match-detail call is rate limited before anything is
            // stored. Dating the list here would have `buildSummaries` answer "no match
            // history" — an answer, not an absence — for the whole freshness window.
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1', 'EUW1_2']);
            riot.getMatchById.mockRejectedValue(
                new HttpException('rate limited', HttpStatus.TOO_MANY_REQUESTS),
            );

            await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([]);

            expect(repository.insertMatch).not.toHaveBeenCalled();
            expect(repository.markListRead).not.toHaveBeenCalled();
        });

        it('never hides a failure that is not Riot itself, and does not date the list', async () => {
            riot.getMatchIdsByPuuid.mockResolvedValue(['EUW1_1']);
            riot.getMatchById.mockRejectedValue(new Error('the pool is gone'));

            await expect(service.findByRiotId(LOOKUP)).rejects.toThrow('the pool is gone');
            expect(repository.markListRead).not.toHaveBeenCalled();
        });
    });

    describe('serving the list, with the duel opponent', () => {
        it('returns an empty list, and never queries participants, when nothing is stored', async () => {
            repository.findRecentByPuuid.mockResolvedValue([]);

            await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([]);
            expect(repository.findParticipantsByMatchIds).not.toHaveBeenCalled();
        });

        it('pairs the player with the opponent at the same position on the other team', async () => {
            const player = participantRow();
            const opponent = participantRow({
                puuid: OPPONENT_PUUID,
                teamId: 200,
                championId: 238,
                win: false,
            });
            repository.findRecentByPuuid.mockResolvedValue([
                { match: matchRow(), player } satisfies MatchWithPlayerRow,
            ]);
            repository.findParticipantsByMatchIds.mockResolvedValue([player, opponent]);

            const [summary] = await service.findByRiotId(LOOKUP);

            expect(summary.player.championId).toBe(103);
            expect(summary.opponent).toMatchObject({ championId: 238, win: false });
        });

        it('never hides a match for lacking an opponent when teamPosition is empty', async () => {
            const player = participantRow({ teamPosition: '' });
            repository.findRecentByPuuid.mockResolvedValue([
                { match: matchRow(), player } satisfies MatchWithPlayerRow,
            ]);
            repository.findParticipantsByMatchIds.mockResolvedValue([player]);

            const [summary] = await service.findByRiotId(LOOKUP);

            expect(summary).toBeDefined();
            expect(summary.opponent).toBeNull();
        });

        it('leaves the opponent null when no other participant shares the position', async () => {
            const player = participantRow();
            const teammate = participantRow({ puuid: 'p-3', teamId: 100 });
            repository.findRecentByPuuid.mockResolvedValue([
                { match: matchRow(), player } satisfies MatchWithPlayerRow,
            ]);
            repository.findParticipantsByMatchIds.mockResolvedValue([player, teammate]);

            const [summary] = await service.findByRiotId(LOOKUP);

            expect(summary.opponent).toBeNull();
        });

        it('carries every participant of the match, not just the player and their opponent', async () => {
            const player = participantRow();
            const opponent = participantRow({
                puuid: OPPONENT_PUUID,
                teamId: 200,
                championId: 238,
                win: false,
            });
            const teammate = participantRow({ puuid: 'p-3', teamId: 100, championId: 64 });
            repository.findRecentByPuuid.mockResolvedValue([
                { match: matchRow(), player } satisfies MatchWithPlayerRow,
            ]);
            repository.findParticipantsByMatchIds.mockResolvedValue([player, opponent, teammate]);

            const [summary] = await service.findByRiotId(LOOKUP);

            expect(summary.participants).toHaveLength(3);
            expect(summary.participants).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ puuid: PUUID, championId: 103 }),
                    expect.objectContaining({ puuid: OPPONENT_PUUID, championId: 238 }),
                    expect.objectContaining({ puuid: 'p-3', championId: 64 }),
                ]),
            );
        });

        it('keeps every participant even when the roster is not ten players, arena among them', async () => {
            const player = participantRow({ teamPosition: '' });
            const others = Array.from({ length: 17 }, (_unused, index) =>
                participantRow({
                    puuid: `arena-${index}`,
                    teamId: 100 + index,
                    teamPosition: '',
                }),
            );
            repository.findRecentByPuuid.mockResolvedValue([
                { match: matchRow(), player } satisfies MatchWithPlayerRow,
            ]);
            repository.findParticipantsByMatchIds.mockResolvedValue([player, ...others]);

            const [summary] = await service.findByRiotId(LOOKUP);

            expect(summary.participants).toHaveLength(18);
            expect(summary.opponent).toBeNull();
        });
    });

    describe('falling back to what is stored when Riot cannot refresh the list', () => {
        it('serves stale matches when the id-list call fails, and says so', async () => {
            repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
            riot.getMatchIdsByPuuid.mockRejectedValue(new BadGatewayException());
            const player = participantRow();
            repository.findRecentByPuuid.mockResolvedValue([
                { match: matchRow(), player } satisfies MatchWithPlayerRow,
            ]);
            repository.findParticipantsByMatchIds.mockResolvedValue([player]);

            const summaries = await service.findByRiotId(LOOKUP);

            expect(summaries).toHaveLength(1);
            expect(warnLog).toHaveBeenCalled();
            expect(riot.getMatchById).not.toHaveBeenCalled();
        });

        it('lets the failure through when the list was never read before', async () => {
            repository.findReadAt.mockResolvedValue(null);
            riot.getMatchIdsByPuuid.mockRejectedValue(new BadGatewayException());

            await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(BadGatewayException);
        });

        it('lets a missing account through as a 404 instead of a stale list', async () => {
            repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
            riot.getMatchIdsByPuuid.mockRejectedValue(new NotFoundException());

            await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
