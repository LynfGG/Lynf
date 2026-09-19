import { foreignKey, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { summoners } from './summoner';

/**
 * When one Riot-backed resource of one account was last read, on one platform.
 *
 * Ranks, masteries and the match id list each: each is fetched from Riot on its own
 * schedule, and each can legitimately have no rows at all — a player ranked nowhere has
 * no row in `summoner_ranks`, a player with no mastery has none in `summoner_masteries`.
 * The absence of rows must still be datable, or Riot would be asked again on every view,
 * so the read date cannot live next to the resource's own rows. It also must not live as
 * one column per resource on `summoners`: that grows a new column for every resource,
 * written by repositories that have no business knowing about each other. A dedicated
 * table, keyed by resource, holds every one of them.
 *
 * `resource` is a short, stable string — `'ranks'`, `'masteries'`, `'matches'` — not a
 * foreign key: nothing else needs to join on it, and the set of resources is closed
 * code, not data.
 */
export const summonerResourceReads = pgTable(
    'summoner_resource_reads',
    {
        puuid: text('puuid').notNull(),
        region: varchar('region', { length: 8 }).notNull(),
        resource: varchar('resource', { length: 32 }).notNull(),
        readAt: timestamp('read_at', { withTimezone: true }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.puuid, table.region, table.resource] }),
        foreignKey({
            columns: [table.puuid, table.region],
            foreignColumns: [summoners.puuid, summoners.region],
        }).onDelete('cascade'),
    ],
);

export type SummonerResourceReadRow = typeof summonerResourceReads.$inferSelect;
export type NewSummonerResourceReadRow = typeof summonerResourceReads.$inferInsert;
