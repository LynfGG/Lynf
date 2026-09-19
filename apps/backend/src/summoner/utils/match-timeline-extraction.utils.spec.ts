import type { RiotMatchTimelineResponse } from '../../riot/types/riot-responses';
import { extractMatchTimeline } from './match-timeline-extraction.utils';

const PUUID_1 = 'puuid-1';
const PUUID_2 = 'puuid-2';

function participantFrame(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        totalGold: 500,
        minionsKilled: 0,
        jungleMinionsKilled: 0,
        xp: 0,
        level: 1,
        ...overrides,
    };
}

function baseTimeline(
    overrides: Partial<{ frames: RiotMatchTimelineResponse['info']['frames'] }> = {},
): RiotMatchTimelineResponse {
    return {
        metadata: { matchId: 'EUW1_1' },
        info: {
            participants: [
                { participantId: 1, puuid: PUUID_1 },
                { participantId: 2, puuid: PUUID_2 },
            ],
            frames: overrides.frames ?? [
                {
                    participantFrames: {
                        '1': participantFrame(),
                        '2': participantFrame(),
                    },
                    events: [],
                },
            ],
        },
    };
}

describe('extractMatchTimeline', () => {
    it('maps matchId straight through', () => {
        const extracted = extractMatchTimeline(baseTimeline());

        expect(extracted.matchId).toBe('EUW1_1');
    });

    describe('frames', () => {
        it('numbers minutes by frame position, starting at zero', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: { '1': participantFrame({ totalGold: 500 }) },
                        events: [],
                    },
                    {
                        participantFrames: { '1': participantFrame({ totalGold: 1_000 }) },
                        events: [],
                    },
                ],
            });

            const extracted = extractMatchTimeline(raw);

            expect(extracted.frames).toEqual([
                expect.objectContaining({ puuid: PUUID_1, minute: 0, totalGold: 500 }),
                expect.objectContaining({ puuid: PUUID_1, minute: 1, totalGold: 1_000 }),
            ]);
        });

        it('combines lane and jungle minions into one creep score', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {
                            '1': participantFrame({ minionsKilled: 40, jungleMinionsKilled: 12 }),
                        },
                        events: [],
                    },
                ],
            });

            const extracted = extractMatchTimeline(raw);

            expect(extracted.frames[0].creepScore).toBe(52);
        });

        it('maps every participant of the frame, keyed by puuid rather than the per-match participant id', () => {
            const extracted = extractMatchTimeline(baseTimeline());

            expect(extracted.frames.map((frame) => frame.puuid).sort()).toEqual(
                [PUUID_1, PUUID_2].sort(),
            );
        });

        it('drops a frame entry for a participant id the timeline never introduced', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: { '99': participantFrame() },
                        events: [],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).frames).toEqual([]);
        });
    });

    describe('item purchases and sales', () => {
        it('keeps purchases and sales in order, per participant', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'ITEM_PURCHASED',
                                timestamp: 5_000,
                                participantId: 1,
                                itemId: 1055,
                            },
                            { type: 'ITEM_SOLD', timestamp: 6_000, participantId: 1, itemId: 1055 },
                        ],
                    },
                ],
            });

            const extracted = extractMatchTimeline(raw);

            expect(extracted.itemEvents).toEqual([
                { puuid: PUUID_1, timestampMs: 5_000, itemId: 1055, action: 'PURCHASED' },
                { puuid: PUUID_1, timestampMs: 6_000, itemId: 1055, action: 'SOLD' },
            ]);
        });

        it('removes the undone purchase, so it never appears in the buy order — rule 4 of the brief', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'ITEM_PURCHASED',
                                timestamp: 5_000,
                                participantId: 1,
                                itemId: 2003,
                            },
                            {
                                type: 'ITEM_UNDO',
                                timestamp: 5_500,
                                participantId: 1,
                                beforeId: 2003,
                                afterId: 0,
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).itemEvents).toEqual([]);
        });

        it('removes the undone sale, restoring the item as never sold', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            { type: 'ITEM_SOLD', timestamp: 5_000, participantId: 1, itemId: 1052 },
                            {
                                type: 'ITEM_UNDO',
                                timestamp: 5_500,
                                participantId: 1,
                                beforeId: 0,
                                afterId: 1052,
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).itemEvents).toEqual([]);
        });

        it('cancels only the most recent matching purchase, keeping an earlier one of the same item', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'ITEM_PURCHASED',
                                timestamp: 1_000,
                                participantId: 1,
                                itemId: 2003,
                            },
                            {
                                type: 'ITEM_PURCHASED',
                                timestamp: 2_000,
                                participantId: 1,
                                itemId: 2003,
                            },
                            {
                                type: 'ITEM_UNDO',
                                timestamp: 2_500,
                                participantId: 1,
                                beforeId: 2003,
                                afterId: 0,
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).itemEvents).toEqual([
                { puuid: PUUID_1, timestampMs: 1_000, itemId: 2003, action: 'PURCHASED' },
            ]);
        });

        it('never cancels another participant’s purchase of the same item', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'ITEM_PURCHASED',
                                timestamp: 1_000,
                                participantId: 2,
                                itemId: 2003,
                            },
                            {
                                type: 'ITEM_UNDO',
                                timestamp: 1_500,
                                participantId: 1,
                                beforeId: 2003,
                                afterId: 0,
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).itemEvents).toEqual([
                { puuid: PUUID_2, timestampMs: 1_000, itemId: 2003, action: 'PURCHASED' },
            ]);
        });

        it('ignores an ITEM_UNDO that matches nothing on record, without throwing', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'ITEM_UNDO',
                                timestamp: 1_000,
                                participantId: 1,
                                beforeId: 3040,
                                afterId: 0,
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).itemEvents).toEqual([]);
        });
    });

    describe('skill level ups', () => {
        it('extracts the participant, the moment and the skill slot', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'SKILL_LEVEL_UP',
                                timestamp: 13_976,
                                participantId: 1,
                                skillSlot: 3,
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).skillLevelUps).toEqual([
                { puuid: PUUID_1, timestampMs: 13_976, skillSlot: 3 },
            ]);
        });
    });

    describe('kills', () => {
        it('extracts the killer, the victim, the moment and the assists', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'CHAMPION_KILL',
                                timestamp: 194_547,
                                killerId: 1,
                                victimId: 2,
                                assistingParticipantIds: [],
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).kills).toEqual([
                {
                    timestampMs: 194_547,
                    killerPuuid: PUUID_1,
                    victimPuuid: PUUID_2,
                    assistingPuuids: [],
                },
            ]);
        });

        it('maps assisting participants to their puuids', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'CHAMPION_KILL',
                                timestamp: 1_000,
                                killerId: 2,
                                victimId: 1,
                                assistingParticipantIds: [2],
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).kills[0].assistingPuuids).toEqual([PUUID_2]);
        });

        it('reports no killer as null, rather than a made-up puuid, for a kill Riot attributes to no one', () => {
            const raw = baseTimeline({
                frames: [
                    {
                        participantFrames: {},
                        events: [
                            {
                                type: 'CHAMPION_KILL',
                                timestamp: 1_000,
                                killerId: 0,
                                victimId: 1,
                                assistingParticipantIds: [],
                            },
                        ],
                    },
                ],
            });

            expect(extractMatchTimeline(raw).kills[0].killerPuuid).toBeNull();
        });
    });

    it('discards every event type this application does not keep', () => {
        const raw = baseTimeline({
            frames: [
                {
                    participantFrames: {},
                    events: [{ type: 'WARD_PLACED', timestamp: 1_000, participantId: 1 }],
                },
            ],
        });

        const extracted = extractMatchTimeline(raw);

        expect(extracted.itemEvents).toEqual([]);
        expect(extracted.skillLevelUps).toEqual([]);
        expect(extracted.kills).toEqual([]);
    });
});
