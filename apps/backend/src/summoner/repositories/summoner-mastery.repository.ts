import type { EPlatformRegion } from '@lynf/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import {
    summonerMasteries,
    type NewSummonerMasteryRow,
    type SummonerMasteryRow,
} from '../../database/schema/index';
import { SummonerResourceReadRepository } from './summoner-resource-read.repository';

/** The name champion masteries are read and dated under in `summoner_resource_reads`. */
const MASTERIES_RESOURCE = 'masteries';

/** Every champion-mastery query lives here, and nothing else does. */
@Injectable()
export class SummonerMasteryRepository {
    constructor(
        @Inject(DATABASE) private readonly database: Database,
        private readonly resourceReadRepository: SummonerResourceReadRepository,
    ) {}

    /**
     * When the masteries of this account were last read from Riot, or null when they
     * never were. A player with no mastery at all has no row, and that answer must be
     * datable too.
     */
    async findReadAt(puuid: string, region: EPlatformRegion): Promise<Date | null> {
        return this.resourceReadRepository.findReadAt(puuid, region, MASTERIES_RESOURCE);
    }

    /** Stored masteries, highest points first — the order the page shows them in. */
    async findByPuuid(puuid: string, region: EPlatformRegion): Promise<SummonerMasteryRow[]> {
        return this.database
            .select()
            .from(summonerMasteries)
            .where(and(eq(summonerMasteries.puuid, puuid), eq(summonerMasteries.region, region)))
            .orderBy(desc(summonerMasteries.championPoints));
    }

    /**
     * Replaces every mastery stored for one account on one platform, and dates the read.
     *
     * It replaces rather than merges, as `summoner_ranks` does: a champion that falls out
     * of the top standings at Riot must fall out here too, and keeping the old row would
     * show a standing that is no longer among the player's best. An empty list is a
     * legitimate answer — the player has never played — and it still dates the read, so
     * Riot is not asked again on the next view.
     */
    async replaceAll(
        puuid: string,
        region: EPlatformRegion,
        masteries: NewSummonerMasteryRow[],
        readAt: Date,
    ): Promise<SummonerMasteryRow[]> {
        return this.database.transaction(async (transaction) => {
            await transaction
                .delete(summonerMasteries)
                .where(
                    and(eq(summonerMasteries.puuid, puuid), eq(summonerMasteries.region, region)),
                );

            const inserted = masteries.length
                ? await transaction.insert(summonerMasteries).values(masteries).returning()
                : [];

            await this.resourceReadRepository.write(
                puuid,
                region,
                MASTERIES_RESOURCE,
                readAt,
                transaction,
            );

            return inserted;
        });
    }
}
