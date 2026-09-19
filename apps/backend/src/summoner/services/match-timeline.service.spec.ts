import { EPlatformRegion } from '@lynf/shared';
import { NotFoundException } from '@nestjs/common';

import type { MatchRow } from '../../database/schema';
import type { MatchTimelineRow } from '../../database/schema/match-timeline';
import type { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotMatchTimelineResponse } from '../../riot/types/riot-responses';
import type { MatchTimelineRepository } from '../repositories/match-timeline.repository';
import type { MatchRepository } from '../repositories/match.repository';
import { MatchTimelineService } from './match-timeline.service';
import type { SummonerService } from './summoner.service';

const LOOKUP = { region: EPlatformRegion.EUW, gameName: 'faker', tagLine: 'kr1' };
const PUUID = 'p-1';
const MATCH_ID = 'EUW1_1';

/** What `SummonerService.resolvePlayer` yields — the single, shared resolution. */
const RESOLVED = { puuid: PUUID, gameName: 'Faker', tagLine: 'KR1' };

function matchRow(overrides: Partial<MatchRow> = {}): MatchRow {
    return {
        matchId: MATCH_ID,
        platformId: 'EUW1',
        queueId: 420,
        durationSeconds: 1_800,
        endedAt: new Date('2026-09-18T10:00:00.000Z'),
        gameVersion: '14.18.1',
        ...overrides,
    };
}

function timelineRow(overrides: Partial<MatchTimelineRow> = {}): MatchTimelineRow {
    return {
        matchId: MATCH_ID,
        frames: [{ puuid: PUUID, minute: 0, totalGold: 500, creepScore: 0, xp: 0, level: 1 }],
        skillLevelUps: [],
        itemEvents: [],
        kills: [],
        ...overrides,
    };
}

function rawTimeline(): RiotMatchTimelineResponse {
    return {
        metadata: { matchId: MATCH_ID },
        info: {
            participants: [{ participantId: 1, puuid: PUUID }],
            frames: [
                {
                    participantFrames: {
                        '1': {
                            totalGold: 500,
                            minionsKilled: 0,
                            jungleMinionsKilled: 0,
                            xp: 0,
                            level: 1,
                        },
                    },
                    events: [],
                },
            ],
        },
    };
}

describe('MatchTimelineService', () => {
    let summoners: jest.Mocked<Pick<SummonerService, 'resolvePlayer'>>;
    let matchRepository: jest.Mocked<Pick<MatchRepository, 'findById'>>;
    let timelineRepository: jest.Mocked<Pick<MatchTimelineRepository, 'findByMatchId' | 'insert'>>;
    let riot: jest.Mocked<Pick<RiotExternal, 'getMatchTimeline'>>;
    let service: MatchTimelineService;

    beforeEach(() => {
        summoners = { resolvePlayer: jest.fn().mockResolvedValue(RESOLVED) };
        matchRepository = { findById: jest.fn().mockResolvedValue(matchRow()) };
        timelineRepository = {
            findByMatchId: jest.fn().mockResolvedValue(undefined),
            insert: jest.fn().mockResolvedValue(undefined),
        };
        riot = { getMatchTimeline: jest.fn().mockResolvedValue(rawTimeline()) };

        service = new MatchTimelineService(
            summoners as unknown as SummonerService,
            matchRepository as unknown as MatchRepository,
            timelineRepository as unknown as MatchTimelineRepository,
            riot as unknown as RiotExternal,
        );
    });

    describe('player resolution', () => {
        it('resolves the player through the single shared resolution before anything else', async () => {
            await service.findByMatchId(LOOKUP, MATCH_ID);

            expect(summoners.resolvePlayer).toHaveBeenCalledWith(LOOKUP);
        });

        it('lets a missing player through as a 404', async () => {
            summoners.resolvePlayer.mockRejectedValue(new NotFoundException());

            await expect(service.findByMatchId(LOOKUP, MATCH_ID)).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });
    });

    describe('a timeline already stored', () => {
        it('serves it without touching Riot or checking the match at all', async () => {
            timelineRepository.findByMatchId.mockResolvedValue(timelineRow());

            const timeline = await service.findByMatchId(LOOKUP, MATCH_ID);

            expect(timeline.matchId).toBe(MATCH_ID);
            expect(matchRepository.findById).not.toHaveBeenCalled();
            expect(riot.getMatchTimeline).not.toHaveBeenCalled();
            expect(timelineRepository.insert).not.toHaveBeenCalled();
        });

        it('returns the four extracted families exactly as stored', async () => {
            timelineRepository.findByMatchId.mockResolvedValue(
                timelineRow({
                    skillLevelUps: [{ puuid: PUUID, timestampMs: 1_000, skillSlot: 0 }],
                    itemEvents: [
                        { puuid: PUUID, timestampMs: 2_000, itemId: 1055, action: 'PURCHASED' },
                    ],
                    kills: [
                        {
                            timestampMs: 3_000,
                            killerPuuid: PUUID,
                            victimPuuid: 'p-2',
                            assistingPuuids: [],
                        },
                    ],
                }),
            );

            const timeline = await service.findByMatchId(LOOKUP, MATCH_ID);

            expect(timeline.skillLevelUps).toEqual([
                { puuid: PUUID, timestampMs: 1_000, skillSlot: 0 },
            ]);
            expect(timeline.itemEvents).toEqual([
                { puuid: PUUID, timestampMs: 2_000, itemId: 1055, action: 'PURCHASED' },
            ]);
            expect(timeline.kills).toEqual([
                { timestampMs: 3_000, killerPuuid: PUUID, victimPuuid: 'p-2', assistingPuuids: [] },
            ]);
        });
    });

    describe('a timeline never fetched', () => {
        it('rejects a match this application never ingested, without calling Riot', async () => {
            matchRepository.findById.mockResolvedValue(undefined);

            await expect(service.findByMatchId(LOOKUP, MATCH_ID)).rejects.toBeInstanceOf(
                NotFoundException,
            );
            expect(riot.getMatchTimeline).not.toHaveBeenCalled();
        });

        it('fetches it from Riot exactly once, extracts it and stores it', async () => {
            const timeline = await service.findByMatchId(LOOKUP, MATCH_ID);

            expect(riot.getMatchTimeline).toHaveBeenCalledTimes(1);
            expect(riot.getMatchTimeline).toHaveBeenCalledWith(MATCH_ID, EPlatformRegion.EUW);
            expect(timelineRepository.insert).toHaveBeenCalledWith(
                expect.objectContaining({ matchId: MATCH_ID }),
            );
            expect(timeline.frames).toEqual([
                { puuid: PUUID, minute: 0, totalGold: 500, creepScore: 0, xp: 0, level: 1 },
            ]);
        });
    });
});
