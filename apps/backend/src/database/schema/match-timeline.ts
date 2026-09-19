import { foreignKey, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { matches } from './match';

/**
 * The four json shapes stored on `match_timelines`, one column per family, mirroring
 * the four exported from `@lynf/shared`'s `match-timeline.ts` field for field. Kept
 * local rather than imported, like `MatchParticipantRunesJson` next door: this
 * schema never depends on `@lynf/shared`.
 */
export type MatchTimelineFrameJson = {
    puuid: string;
    minute: number;
    totalGold: number;
    creepScore: number;
    xp: number;
    level: number;
};

export type MatchTimelineSkillLevelUpJson = {
    puuid: string;
    timestampMs: number;
    skillSlot: number;
};

export type MatchTimelineItemEventJson = {
    puuid: string;
    timestampMs: number;
    itemId: number;
    action: 'PURCHASED' | 'SOLD';
};

export type MatchTimelineKillJson = {
    timestampMs: number;
    killerPuuid: string | null;
    victimPuuid: string;
    assistingPuuids: string[];
};

/**
 * The timeline extracted from one match's `match-v5` timeline, one row per match.
 *
 * `matchId` doubles as the primary key, exactly like `matches` itself: a timeline has
 * no existence apart from its match. Four `jsonb` columns, one per family, hold what is
 * kept of Riot's raw response — a nested array of at most a few hundred small records
 * each, never queried by its insides in SQL, so a relational breakdown (a table per
 * family, keyed by match and minute or timestamp) would buy nothing here that a plain
 * `jsonb` array does not already give for free; it would only add four join tables for
 * data that is always read and written whole, per match.
 *
 * There is no freshness column here, unlike `summoner_ranks` or the match id list:
 * a timeline is immutable the moment it exists, so "is this row still fresh?" is not a
 * question that applies — its mere presence is the only fact `MatchTimelineRepository`
 * ever needs.
 */
export const matchTimelines = pgTable(
    'match_timelines',
    {
        matchId: text('match_id').primaryKey(),
        frames: jsonb('frames').$type<MatchTimelineFrameJson[]>().notNull(),
        skillLevelUps: jsonb('skill_level_ups').$type<MatchTimelineSkillLevelUpJson[]>().notNull(),
        itemEvents: jsonb('item_events').$type<MatchTimelineItemEventJson[]>().notNull(),
        kills: jsonb('kills').$type<MatchTimelineKillJson[]>().notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.matchId],
            foreignColumns: [matches.matchId],
        }).onDelete('cascade'),
    ],
);

export type MatchTimelineRow = typeof matchTimelines.$inferSelect;
export type NewMatchTimelineRow = typeof matchTimelines.$inferInsert;
