/**
 * What an item event does to a participant's inventory. `ITEM_UNDO` is not a third
 * action: it is resolved away when the timeline is extracted from Riot's raw response,
 * so an undone purchase or sale never reaches this contract at all — see the back
 * end's `match-timeline-extraction.utils.ts` for where that happens.
 */
export const EMatchTimelineItemAction = {
    PURCHASED: 'PURCHASED',
    SOLD: 'SOLD',
} as const;

export type EMatchTimelineItemAction =
    (typeof EMatchTimelineItemAction)[keyof typeof EMatchTimelineItemAction];

/**
 * One participant's standing at one minute of the game. `creepScore` combines lane and
 * jungle minions, the same choice already made for `MatchParticipantSummary`, so a
 * chart built from one reads consistently with a card built from the other.
 */
export type MatchTimelineFrame = {
    puuid: string;
    /** `0` for the game's first minute, `1` for the second, and so on. */
    minute: number;
    totalGold: number;
    creepScore: number;
    xp: number;
    level: number;
};

/** One skill point spent, at the moment it was spent. */
export type MatchTimelineSkillLevelUp = {
    puuid: string;
    timestampMs: number;
    /** `0`–`3`: Q, W, E, R, in Riot's own numbering. */
    skillSlot: number;
};

/** One item bought or sold, at the moment it happened. An undone purchase or sale is
 * never reported here at all. */
export type MatchTimelineItemEvent = {
    puuid: string;
    timestampMs: number;
    itemId: number;
    action: EMatchTimelineItemAction;
};

/**
 * One champion kill, at the moment it happened.
 *
 * `killerPuuid` is `null` for the rare kill Riot itself does not attribute to a
 * player — an execution, most often. `assistingPuuids` is empty, never omitted, when
 * no one assisted.
 */
export type MatchTimelineKill = {
    timestampMs: number;
    killerPuuid: string | null;
    victimPuuid: string;
    assistingPuuids: string[];
};

/**
 * What the three timeline tabs are built from — everything else `match-v5`'s timeline
 * reports (positions, damage breakdowns, per-frame champion stats) is discarded at
 * extraction, never stored. There is deliberately no damage-per-minute series: Riot's
 * timeline does not report one, and none is derived from what it does report.
 */
export type MatchTimeline = {
    matchId: string;
    frames: MatchTimelineFrame[];
    skillLevelUps: MatchTimelineSkillLevelUp[];
    itemEvents: MatchTimelineItemEvent[];
    kills: MatchTimelineKill[];
};
