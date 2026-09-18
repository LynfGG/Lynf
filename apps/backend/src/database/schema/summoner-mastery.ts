import {
    foreignKey,
    integer,
    pgTable,
    primaryKey,
    text,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core';

import { summoners } from './summoner';

/**
 * A player's mastery of one champion, as last seen from Riot.
 *
 * Rows are a cache, dated in `summoner_resource_reads` under the resource
 * `'masteries'` — the same reason `summoner_ranks` has no read date of its own: a
 * player with no mastery at all has no row here, and that absence must still be
 * datable, or Riot would be asked again on every view.
 *
 * `championId` is Riot's numeric champion id, not Data Dragon's textual one — turning
 * one into the other belongs to the front end, which already fetches Data Dragon's
 * champion catalogue for profile icons. `lastPlayTime` arrives from Riot as epoch
 * milliseconds and is converted to a timestamp here, like every other date in this
 * schema, rather than stored as the raw number.
 */
export const summonerMasteries = pgTable(
    'summoner_masteries',
    {
        puuid: text('puuid').notNull(),
        region: varchar('region', { length: 8 }).notNull(),
        championId: integer('champion_id').notNull(),
        championLevel: integer('champion_level').notNull(),
        championPoints: integer('champion_points').notNull(),
        lastPlayTime: timestamp('last_play_time', { withTimezone: true }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.puuid, table.region, table.championId] }),
        foreignKey({
            columns: [table.puuid, table.region],
            foreignColumns: [summoners.puuid, summoners.region],
        }).onDelete('cascade'),
    ],
);

export type SummonerMasteryRow = typeof summonerMasteries.$inferSelect;
export type NewSummonerMasteryRow = typeof summonerMasteries.$inferInsert;
