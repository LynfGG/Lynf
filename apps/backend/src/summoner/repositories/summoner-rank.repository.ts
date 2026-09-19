import type { EPlatformRegion } from '@lynf/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import {
    summonerRanks,
    type NewSummonerRankRow,
    type SummonerRankRow,
} from '../../database/schema/index';
import { SummonerResourceReadRepository } from './summoner-resource-read.repository';

/** The name ranked standings are read and dated under in `summoner_resource_reads`. */
const RANKS_RESOURCE = 'ranks';

/**
 * Every ranked-standing query lives here, and nothing else does.
 *
 * It injects `SummonerResourceReadRepository` — a declared exception to "a repository
 * never depends on another repository" (see `docs/architecture.md#database-access`):
 * `replaceAll` must date the read in the very same transaction it writes the standings
 * in, so a failure between the two can never leave rows stored but undated.
 */
@Injectable()
export class SummonerRankRepository {
    constructor(
        @Inject(DATABASE) private readonly database: Database,
        private readonly resourceReadRepository: SummonerResourceReadRepository,
    ) {}

    /**
     * When the standings of this account were last read from Riot, or null when they never
     * were. A player ranked nowhere has no rank row, and that answer must be datable too.
     */
    async findReadAt(puuid: string, region: EPlatformRegion): Promise<Date | null> {
        return this.resourceReadRepository.findReadAt(puuid, region, RANKS_RESOURCE);
    }

    async findByPuuid(puuid: string, region: EPlatformRegion): Promise<SummonerRankRow[]> {
        return this.database
            .select()
            .from(summonerRanks)
            .where(and(eq(summonerRanks.puuid, puuid), eq(summonerRanks.region, region)));
    }

    /**
     * Replaces every standing stored for one account on one platform, and dates the read.
     *
     * It replaces rather than merges: a player who stopped playing a queue disappears
     * from it at Riot, and keeping the old row would show a rank that no longer exists.
     * An empty list is a legitimate answer — the player is ranked nowhere — and it still
     * dates the read, so Riot is not asked again on the next view.
     */
    async replaceAll(
        puuid: string,
        region: EPlatformRegion,
        ranks: NewSummonerRankRow[],
        readAt: Date,
    ): Promise<SummonerRankRow[]> {
        return this.database.transaction(async (transaction) => {
            await transaction
                .delete(summonerRanks)
                .where(and(eq(summonerRanks.puuid, puuid), eq(summonerRanks.region, region)));

            const inserted = ranks.length
                ? await transaction.insert(summonerRanks).values(ranks).returning()
                : [];

            await this.resourceReadRepository.write(
                puuid,
                region,
                RANKS_RESOURCE,
                readAt,
                transaction,
            );

            return inserted;
        });
    }
}
