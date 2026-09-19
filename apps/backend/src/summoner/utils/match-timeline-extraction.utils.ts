import type {
    MatchTimelineFrameJson,
    MatchTimelineItemEventJson,
    MatchTimelineKillJson,
    MatchTimelineSkillLevelUpJson,
    NewMatchTimelineRow,
} from '../../database/schema/match-timeline';
import type {
    RiotMatchTimelineEventResponse,
    RiotMatchTimelineResponse,
} from '../../riot/types/riot-responses';

/** Riot's event type strings this extraction reads. Every other type is discarded. */
const ITEM_PURCHASED = 'ITEM_PURCHASED';
const ITEM_SOLD = 'ITEM_SOLD';
const ITEM_UNDO = 'ITEM_UNDO';
const SKILL_LEVEL_UP = 'SKILL_LEVEL_UP';
const CHAMPION_KILL = 'CHAMPION_KILL';

/**
 * Riot has no player id `0`: it is the sentinel `killerId` carries for the rare kill it
 * does not attribute to a participant (an execution, most often), and the sentinel
 * `ITEM_UNDO`'s `beforeId`/`afterId` carry for "nothing on this side".
 */
const NO_PARTICIPANT = 0;

/**
 * Turns one match's raw `match-v5` timeline into the four families
 * `match_timelines` stores, discarding everything else Riot reports — positions,
 * live champion stats, damage breakdowns — none of which any tab uses.
 *
 * This is where rule 4 of the timeline brief is enforced: `ITEM_UNDO` removes the
 * purchase or sale it reverses from `itemEvents` before this function ever returns, so
 * an undone item never reaches storage, let alone the screen. That makes it a data
 * rule, not a presentation one — exactly what the brief asks for.
 */
export function extractMatchTimeline(raw: RiotMatchTimelineResponse): NewMatchTimelineRow {
    const puuidByParticipantId = new Map(
        raw.info.participants.map(({ participantId, puuid }) => [participantId, puuid]),
    );

    const frames = extractFrames(raw, puuidByParticipantId);
    const { itemEvents, skillLevelUps, kills } = extractEvents(raw, puuidByParticipantId);

    return {
        matchId: raw.metadata.matchId,
        frames,
        itemEvents,
        skillLevelUps,
        kills,
    };
}

function extractFrames(
    raw: RiotMatchTimelineResponse,
    puuidByParticipantId: Map<number, string>,
): MatchTimelineFrameJson[] {
    const frames: MatchTimelineFrameJson[] = [];

    raw.info.frames.forEach((frame, minute) => {
        for (const [participantId, participantFrame] of Object.entries(frame.participantFrames)) {
            const puuid = puuidByParticipantId.get(Number(participantId));

            if (!puuid) {
                continue;
            }

            frames.push({
                puuid,
                minute,
                totalGold: participantFrame.totalGold,
                creepScore: participantFrame.minionsKilled + participantFrame.jungleMinionsKilled,
                xp: participantFrame.xp,
                level: participantFrame.level,
            });
        }
    });

    return frames;
}

function extractEvents(
    raw: RiotMatchTimelineResponse,
    puuidByParticipantId: Map<number, string>,
): {
    itemEvents: MatchTimelineItemEventJson[];
    skillLevelUps: MatchTimelineSkillLevelUpJson[];
    kills: MatchTimelineKillJson[];
} {
    const itemEvents: MatchTimelineItemEventJson[] = [];
    const skillLevelUps: MatchTimelineSkillLevelUpJson[] = [];
    const kills: MatchTimelineKillJson[] = [];

    const puuidOf = (participantId: number | undefined) =>
        participantId === undefined ? undefined : puuidByParticipantId.get(participantId);

    for (const frame of raw.info.frames) {
        for (const event of frame.events) {
            switch (event.type) {
                case ITEM_PURCHASED:
                case ITEM_SOLD: {
                    const puuid = puuidOf(event.participantId);

                    if (puuid && event.itemId !== undefined) {
                        itemEvents.push({
                            puuid,
                            timestampMs: event.timestamp,
                            itemId: event.itemId,
                            action: event.type === ITEM_PURCHASED ? 'PURCHASED' : 'SOLD',
                        });
                    }

                    break;
                }

                case ITEM_UNDO: {
                    const puuid = puuidOf(event.participantId);

                    if (puuid) {
                        undoItemEvent(itemEvents, puuid, event);
                    }

                    break;
                }

                case SKILL_LEVEL_UP: {
                    const puuid = puuidOf(event.participantId);

                    if (puuid && event.skillSlot !== undefined) {
                        skillLevelUps.push({
                            puuid,
                            timestampMs: event.timestamp,
                            skillSlot: event.skillSlot,
                        });
                    }

                    break;
                }

                case CHAMPION_KILL: {
                    if (event.victimId === undefined) {
                        break;
                    }

                    const victimPuuid = puuidOf(event.victimId);

                    if (!victimPuuid) {
                        break;
                    }

                    kills.push({
                        timestampMs: event.timestamp,
                        killerPuuid:
                            event.killerId !== undefined && event.killerId !== NO_PARTICIPANT
                                ? (puuidOf(event.killerId) ?? null)
                                : null,
                        victimPuuid,
                        assistingPuuids: (event.assistingParticipantIds ?? [])
                            .map((id) => puuidOf(id))
                            .filter((puuid): puuid is string => puuid !== undefined),
                    });

                    break;
                }

                default:
                    break;
            }
        }
    }

    return { itemEvents, skillLevelUps, kills };
}

/**
 * Reverses one `ITEM_UNDO`, in place. `beforeId` (non-zero) names the item whose
 * purchase is being undone; `afterId` (non-zero) names the item whose sale is being
 * undone. Both were verified live, on the same real match: a build with an upgraded
 * item undone (`beforeId`) and a sold item un-sold (`afterId`).
 *
 * Only the *most recent* matching event for this player is removed — searching from
 * the end — so buying the same item twice and undoing once cancels the later purchase,
 * not an earlier, already-kept one.
 */
function undoItemEvent(
    itemEvents: MatchTimelineItemEventJson[],
    puuid: string,
    event: RiotMatchTimelineEventResponse,
): void {
    if (event.beforeId !== undefined && event.beforeId !== NO_PARTICIPANT) {
        removeLastMatch(itemEvents, puuid, event.beforeId, 'PURCHASED');
    }

    if (event.afterId !== undefined && event.afterId !== NO_PARTICIPANT) {
        removeLastMatch(itemEvents, puuid, event.afterId, 'SOLD');
    }
}

function removeLastMatch(
    itemEvents: MatchTimelineItemEventJson[],
    puuid: string,
    itemId: number,
    action: 'PURCHASED' | 'SOLD',
): void {
    for (let index = itemEvents.length - 1; index >= 0; index -= 1) {
        const candidate = itemEvents[index];

        if (
            candidate.puuid === puuid &&
            candidate.itemId === itemId &&
            candidate.action === action
        ) {
            itemEvents.splice(index, 1);
            return;
        }
    }
}
