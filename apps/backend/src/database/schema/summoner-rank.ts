import { foreignKey, integer, pgTable, primaryKey, text, varchar } from 'drizzle-orm/pg-core';

import { summoners } from './summoner';

/**
 * A player's standing in one ranked queue, as last seen from Riot.
 *
 * Rows are a cache. Their freshness is not stored here but in
 * `summoner_resource_reads` (resource `'ranks'`): a player who is ranked nowhere has no
 * row at all, and the absence of rows must itself be datable, or Riot would be asked
 * again on every view.
 */
export const summonerRanks = pgTable(
    'summoner_ranks',
    {
        puuid: text('puuid').notNull(),
        region: varchar('region', { length: 8 }).notNull(),
        queue: varchar('queue', { length: 32 }).notNull(),
        tier: varchar('tier', { length: 16 }).notNull(),
        division: varchar('division', { length: 4 }).notNull(),
        leaguePoints: integer('league_points').notNull(),
        wins: integer('wins').notNull(),
        losses: integer('losses').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.puuid, table.region, table.queue] }),
        foreignKey({
            columns: [table.puuid, table.region],
            foreignColumns: [summoners.puuid, summoners.region],
        }).onDelete('cascade'),
    ],
);

export type SummonerRankRow = typeof summonerRanks.$inferSelect;
export type NewSummonerRankRow = typeof summonerRanks.$inferInsert;
