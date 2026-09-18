import type { EPlatformRegion } from '@lynf/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import { summonerResourceReads } from '../../database/schema/index';

/**
 * A database or an open transaction on it. A write here must be able to join the
 * transaction of the repository that calls it, so that writing the resource's rows and
 * dating the read commit or roll back together.
 */
type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * When a Riot-backed resource of one account was last read — and nothing else.
 *
 * It knows neither ranks nor masteries: `resource` is an opaque short string to it,
 * supplied by the repository that owns that resource.
 */
@Injectable()
export class SummonerResourceReadRepository {
    constructor(@Inject(DATABASE) private readonly database: Database) {}

    /** When `resource` was last read for this account, or null when it never was. */
    async findReadAt(
        puuid: string,
        region: EPlatformRegion,
        resource: string,
    ): Promise<Date | null> {
        const [row] = await this.database
            .select({ readAt: summonerResourceReads.readAt })
            .from(summonerResourceReads)
            .where(
                and(
                    eq(summonerResourceReads.puuid, puuid),
                    eq(summonerResourceReads.region, region),
                    eq(summonerResourceReads.resource, resource),
                ),
            );

        return row?.readAt ?? null;
    }

    /**
     * Records that `resource` was read at `readAt`, replacing any earlier date.
     *
     * Takes the executor to write through — the caller's own transaction when the read
     * date must commit with the rows it dates, the plain database otherwise — rather
     * than opening one of its own.
     */
    async write(
        puuid: string,
        region: EPlatformRegion,
        resource: string,
        readAt: Date,
        executor: Executor = this.database,
    ): Promise<void> {
        await executor
            .insert(summonerResourceReads)
            .values({ puuid, region, resource, readAt })
            .onConflictDoUpdate({
                target: [
                    summonerResourceReads.puuid,
                    summonerResourceReads.region,
                    summonerResourceReads.resource,
                ],
                set: { readAt },
            });
    }
}
