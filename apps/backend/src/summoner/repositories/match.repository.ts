import type { EPlatformRegion } from '@lynf/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import {
    matchParticipants,
    matches,
    type MatchParticipantRow,
    type MatchRow,
    type NewMatchParticipantRow,
    type NewMatchRow,
} from '../../database/schema/index';
import { SummonerResourceReadRepository } from './summoner-resource-read.repository';

/** The name the match id list is read and dated under in `summoner_resource_reads`. */
const MATCHES_RESOURCE = 'matches';

/** One finished match, joined with the tracked player's own line in it. */
export type MatchWithPlayerRow = {
    match: MatchRow;
    player: MatchParticipantRow;
};

/**
 * Every match query lives here, and nothing else does.
 *
 * Unlike ranks and masteries, matches are never replaced: a finished match is
 * immutable, so it is written once, with `onConflictDoNothing` guarding only against
 * two overlapping refreshes racing to store the same match — never against Riot
 * answering something new for an id already stored.
 *
 * It injects `SummonerResourceReadRepository` — a declared exception to "a repository
 * never depends on another repository" (see `docs/architecture.md#database-access`), for
 * the same reason `SummonerRankRepository` and `SummonerMasteryRepository` do: the
 * `summoner_resource_reads` bookkeeping is shared rather than reimplemented three
 * times, and its `write` can join whichever transaction dates a resource alongside the
 * rows it describes — ranks and masteries use that; the match id list has no single row
 * of its own to co-write with, so `markListRead` writes it directly, once ingestion has
 * run to completion (see `ingest` below).
 */
@Injectable()
export class MatchRepository {
    constructor(
        @Inject(DATABASE) private readonly database: Database,
        private readonly resourceReadRepository: SummonerResourceReadRepository,
    ) {}

    /**
     * When the match id list of this account was last read from Riot, or null when it
     * never was. This dates the *list*, not any individual match: a match already
     * stored is never re-read, however old it is.
     */
    async findReadAt(puuid: string, region: EPlatformRegion): Promise<Date | null> {
        return this.resourceReadRepository.findReadAt(puuid, region, MATCHES_RESOURCE);
    }

    /** Records that the match id list of this account was read at `readAt`. */
    async markListRead(puuid: string, region: EPlatformRegion, readAt: Date): Promise<void> {
        await this.resourceReadRepository.write(puuid, region, MATCHES_RESOURCE, readAt);
    }

    /** Which of these match ids are already stored — the ones never asked of Riot again. */
    async findExistingMatchIds(matchIds: string[]): Promise<Set<string>> {
        if (matchIds.length === 0) {
            return new Set();
        }

        const rows = await this.database
            .select({ matchId: matches.matchId })
            .from(matches)
            .where(inArray(matches.matchId, matchIds));

        return new Set(rows.map((row) => row.matchId));
    }

    /**
     * Stores one freshly fetched match and its ten participants together, or none of
     * them: a match is only ever useful whole. Run once per match, right after it is
     * fetched, so a later match failing — a 429 mid-ingestion — never undoes this one.
     */
    async insertMatch(match: NewMatchRow, participants: NewMatchParticipantRow[]): Promise<void> {
        await this.database.transaction(async (transaction) => {
            await transaction.insert(matches).values(match).onConflictDoNothing();
            await transaction.insert(matchParticipants).values(participants).onConflictDoNothing();
        });
    }

    /**
     * The stored match itself, or `undefined` when it was never ingested. Used before a
     * timeline is fetched: `match_timelines.matchId` is foreign-keyed to this table, so
     * a match Lynf never stored can never gain a timeline row, and asking Riot for one
     * would only spend quota on a match this application does not track.
     */
    async findById(matchId: string): Promise<MatchRow | undefined> {
        const [row] = await this.database
            .select()
            .from(matches)
            .where(eq(matches.matchId, matchId))
            .limit(1);

        return row;
    }

    /** The most recent matches of this account, newest first, each with its own line. */
    async findRecentByPuuid(puuid: string, limit: number): Promise<MatchWithPlayerRow[]> {
        return this.database
            .select({ match: matches, player: matchParticipants })
            .from(matches)
            .innerJoin(
                matchParticipants,
                and(
                    eq(matchParticipants.matchId, matches.matchId),
                    eq(matchParticipants.puuid, puuid),
                ),
            )
            .orderBy(desc(matches.endedAt))
            .limit(limit);
    }

    /**
     * Every participant of these matches — all ten per match, the tracked player
     * included — used to find the opponent who held the same lane.
     */
    async findParticipantsByMatchIds(matchIds: string[]): Promise<MatchParticipantRow[]> {
        if (matchIds.length === 0) {
            return [];
        }

        return this.database
            .select()
            .from(matchParticipants)
            .where(inArray(matchParticipants.matchId, matchIds));
    }
}
