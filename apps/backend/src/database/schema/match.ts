import { integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * A finished match, exactly as Riot reported it — nothing here depends on a player.
 *
 * A match is immutable once it is over: its result, its participants and their stats
 * never change, so a row here is written once and never updated, only ever read.
 * `matchId` is Riot's own id (e.g. `EUW1_1234567890`) and doubles as the primary key —
 * it is already globally unique and never reused, so no surrogate id earns its keep.
 */
export const matches = pgTable('matches', {
    matchId: text('match_id').primaryKey(),
    /** The platform the match was played on, as Riot spells it (e.g. `EUW1`). */
    platformId: varchar('platform_id', { length: 8 }).notNull(),
    /** Riot's numeric queue id, e.g. `420` for ranked solo/duo. */
    queueId: integer('queue_id').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    gameVersion: varchar('game_version', { length: 32 }).notNull(),
});

export type MatchRow = typeof matches.$inferSelect;
export type NewMatchRow = typeof matches.$inferInsert;
