import type { EPlatformRegion } from '@lynf/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import {
    summonerRanks,
    summoners,
    type NewSummonerRankRow,
    type SummonerRankRow,
} from '../../database/schema/index';

/** Every ranked-standing query lives here, and nothing else does. */
@Injectable()
export class SummonerRankRepository {
    constructor(@Inject(DATABASE) private readonly database: Database) {}

    /**
     * When the standings of this account were last read from Riot, or null when they never
     * were. It is stored on the summoner: a player ranked nowhere has no rank row, and
     * that answer must be datable too.
     */
    async findReadAt(puuid: string, region: EPlatformRegion): Promise<Date | null> {
        const [row] = await this.database
            .select({ readAt: summoners.ranksUpdatedAt })
            .from(summoners)
            .where(and(eq(summoners.puuid, puuid), eq(summoners.region, region)));

        return row?.readAt ?? null;
    }

    async findByPuuid(puuid: string, region: EPlatformRegion): Promise<SummonerRankRow[]> {
        return this.database
            .select()
            .from(summonerRanks)
            .where(and(eq(summonerRanks.puuid, puuid), eq(summonerRanks.region, region)));
    }

    /**
     * Replaces every standing stored for one account on one platform, and dates the read
     * on the summoner itself.
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

            await transaction
                .update(summoners)
                .set({ ranksUpdatedAt: readAt })
                .where(and(eq(summoners.puuid, puuid), eq(summoners.region, region)));

            return inserted;
        });
    }
}
