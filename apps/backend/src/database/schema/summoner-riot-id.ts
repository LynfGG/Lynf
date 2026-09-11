import { foreignKey, pgTable, primaryKey, text, varchar } from 'drizzle-orm/pg-core';

import { summoners } from './summoner';

/**
 * Every Riot ID a profile has been found under, on one platform.
 *
 * Riot's lookup is more forgiving than an exact comparison: searching `Caps#EUW` returns
 * the account Riot writes `Cäps#EUW`. Comparing a search with the name Riot returned
 * would miss that profile every time — and with it, the stored profile a failed Riot
 * call falls back on. So both are recorded: the Riot ID as searched, and as returned.
 *
 * Riot IDs ignore case: they are stored in lower case.
 */
export const summonerRiotIds = pgTable(
    'summoner_riot_ids',
    {
        region: varchar('region', { length: 8 }).notNull(),
        gameName: text('game_name').notNull(),
        tagLine: text('tag_line').notNull(),
        puuid: text('puuid').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.region, table.gameName, table.tagLine] }),
        foreignKey({
            columns: [table.puuid, table.region],
            foreignColumns: [summoners.puuid, summoners.region],
        }).onDelete('cascade'),
    ],
);
