import { integer, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * A player's profile on one platform, as last seen from Riot.
 *
 * The row is a cache, not a source of truth: `updatedAt` is what lets the service
 * decide whether it is worth asking Riot again.
 *
 * A puuid identifies an account on every platform, but the level and the icon belong
 * to one platform — hence one row per account *and* platform.
 */
export const summoners = pgTable(
    'summoners',
    {
        puuid: text('puuid').notNull(),
        region: varchar('region', { length: 8 }).notNull(),
        gameName: text('game_name').notNull(),
        tagLine: text('tag_line').notNull(),
        profileIconId: integer('profile_icon_id').notNull(),
        summonerLevel: integer('summoner_level').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        /**
         * When the ranked standings of this account were last read from Riot. Null means
         * never. It lives here rather than on `summoner_ranks` because a player who is
         * ranked nowhere has no row there, and that answer must be datable too.
         */
        ranksUpdatedAt: timestamp('ranks_updated_at', { withTimezone: true }),
    },
    (table) => [primaryKey({ columns: [table.puuid, table.region] })],
);

export type SummonerRow = typeof summoners.$inferSelect;
export type NewSummonerRow = typeof summoners.$inferInsert;
