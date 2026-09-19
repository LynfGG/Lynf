import {
    boolean,
    foreignKey,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    text,
    varchar,
} from 'drizzle-orm/pg-core';

import { matches } from './match';

/**
 * A participant's runes, mirroring `MatchParticipantRunes` in `@lynf/shared` field for
 * field. Kept as a local type rather than importing the shared one: nothing else in
 * this schema depends on `@lynf/shared`, and a jsonb column's shape is this table's
 * concern, not the contract's.
 */
export type MatchParticipantRunesJson = {
    primaryStyle: number;
    primaryPerks: number[];
    subStyle: number;
    subPerks: number[];
    statPerks: {
        offense: number;
        flex: number;
        defense: number;
    };
};

/**
 * One player's line in one finished match — ten rows per match on Summoner's Rift, more
 * on modes with a different roster size (Arena's eight teams of two, for instance).
 *
 * Deliberately **not** foreign-keyed to `summoners`, unlike every puuid-bearing table
 * elsewhere in this schema: the other players of a match are not accounts Lynf tracks,
 * and requiring their presence in `summoners` would force creating a profile — never
 * refreshed, never looked up on its own — for every single match ingested. The only
 * foreign key here is to the match itself, cascading so a deleted match takes its
 * participants with it.
 *
 * `riotIdGameName` and `riotIdTagline` are the display name Riot reported *for this
 * match*, not a live lookup: a name change afterwards does not rewrite history.
 */
export const matchParticipants = pgTable(
    'match_participants',
    {
        matchId: text('match_id').notNull(),
        puuid: text('puuid').notNull(),
        teamId: integer('team_id').notNull(),
        championId: integer('champion_id').notNull(),
        /** `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`, or empty — see the brief. */
        teamPosition: varchar('team_position', { length: 16 }).notNull(),
        win: boolean('win').notNull(),
        kills: integer('kills').notNull(),
        deaths: integer('deaths').notNull(),
        assists: integer('assists').notNull(),
        /** Lane and jungle minions killed, combined: the one number a duel ever shows. */
        creepScore: integer('creep_score').notNull(),
        goldEarned: integer('gold_earned').notNull(),
        totalDamageDealtToChampions: integer('total_damage_dealt_to_champions').notNull(),
        /** Seven slots, trinket included, in Riot's own order; an empty slot is `0`. */
        items: integer('items').array().notNull(),
        riotIdGameName: text('riot_id_game_name').notNull(),
        riotIdTagline: text('riot_id_tagline').notNull(),
        /**
         * Nullable, and deliberately never backfilled: the matches already stored
         * before this column existed were ingested without runes, a match is
         * immutable, and it is never re-read from Riot just to fill a gap. To repopulate
         * development data with runes, empty this table (or `matches`, which cascades
         * to it) and let ingestion run again — never done automatically.
         */
        runes: jsonb('runes').$type<MatchParticipantRunesJson>(),
    },
    (table) => [
        primaryKey({ columns: [table.matchId, table.puuid] }),
        foreignKey({
            columns: [table.matchId],
            foreignColumns: [matches.matchId],
        }).onDelete('cascade'),
    ],
);

export type MatchParticipantRow = typeof matchParticipants.$inferSelect;
export type NewMatchParticipantRow = typeof matchParticipants.$inferInsert;
