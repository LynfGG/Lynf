import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import {
    matchTimelines,
    type MatchTimelineRow,
    type NewMatchTimelineRow,
} from '../../database/schema/index';

/**
 * Every timeline query lives here, and nothing else does.
 *
 * A timeline is immutable the moment it is extracted, exactly like the match it
 * belongs to: there is no freshness to track, so unlike `summoner_ranks` or the match
 * id list, this repository carries no read date and no TTL. `findByMatchId` returning a
 * row at all is the only fact `MatchTimelineService` needs before deciding whether to
 * ask Riot.
 */
@Injectable()
export class MatchTimelineRepository {
    constructor(@Inject(DATABASE) private readonly database: Database) {}

    /** The stored timeline of one match, or `undefined` when it was never extracted. */
    async findByMatchId(matchId: string): Promise<MatchTimelineRow | undefined> {
        const [row] = await this.database
            .select()
            .from(matchTimelines)
            .where(eq(matchTimelines.matchId, matchId))
            .limit(1);

        return row;
    }

    /**
     * Stores one freshly extracted timeline. `onConflictDoNothing` guards only against
     * two overlapping requests racing to extract the same match's timeline — never
     * against a timeline changing, since it never does.
     */
    async insert(timeline: NewMatchTimelineRow): Promise<void> {
        await this.database.transaction(async (transaction) => {
            await transaction.insert(matchTimelines).values(timeline).onConflictDoNothing();
        });
    }
}
