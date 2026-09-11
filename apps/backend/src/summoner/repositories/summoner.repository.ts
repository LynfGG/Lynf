import type { RiotIdLookup } from '@lynf/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, getTableColumns } from 'drizzle-orm';

import { DATABASE, type Database } from '../../database/database.module';
import {
    summonerRiotIds,
    summoners,
    type NewSummonerRow,
    type SummonerRow,
} from '../../database/schema/index';

/** Riot IDs ignore case: they are stored, and compared, in lower case. */
function normaliseRiotId(gameName: string, tagLine: string) {
    return { gameName: gameName.toLowerCase(), tagLine: tagLine.toLowerCase() };
}

/**
 * Every summoner query lives here, and nothing else does.
 *
 * It depends on the database client alone — no service, no other repository,
 * no external.
 */
@Injectable()
export class SummonerRepository {
    constructor(@Inject(DATABASE) private readonly database: Database) {}

    /** Finds a profile under any Riot ID it was found under before, whatever the case. */
    async findByRiotId({
        region,
        gameName,
        tagLine,
    }: RiotIdLookup): Promise<SummonerRow | undefined> {
        const riotId = normaliseRiotId(gameName, tagLine);

        const [row] = await this.database
            .select(getTableColumns(summoners))
            .from(summonerRiotIds)
            .innerJoin(
                summoners,
                and(
                    eq(summoners.puuid, summonerRiotIds.puuid),
                    eq(summoners.region, summonerRiotIds.region),
                ),
            )
            .where(
                and(
                    eq(summonerRiotIds.region, region),
                    eq(summonerRiotIds.gameName, riotId.gameName),
                    eq(summonerRiotIds.tagLine, riotId.tagLine),
                ),
            );

        return row;
    }

    /**
     * Stores a freshly fetched profile, replacing what was stored for the same account on
     * the same platform, along with the Riot IDs it can be found under: the one searched
     * and the one Riot returned. A Riot ID already pointing at another account — it
     * changed hands — now points at this one.
     *
     * Runs in a transaction: the conventions require it for every write, and the profile
     * and its Riot IDs must be written together or not at all.
     */
    async save(profile: NewSummonerRow, searchedAs: RiotIdLookup): Promise<SummonerRow> {
        return this.database.transaction(async (transaction) => {
            const [row] = await transaction
                .insert(summoners)
                .values(profile)
                .onConflictDoUpdate({
                    target: [summoners.puuid, summoners.region],
                    set: {
                        gameName: profile.gameName,
                        tagLine: profile.tagLine,
                        profileIconId: profile.profileIconId,
                        summonerLevel: profile.summonerLevel,
                        updatedAt: profile.updatedAt ?? new Date(),
                    },
                })
                .returning();

            const riotIds = [
                normaliseRiotId(searchedAs.gameName, searchedAs.tagLine),
                normaliseRiotId(profile.gameName, profile.tagLine),
            ];

            // Usually the search and Riot's answer are the same Riot ID. It is written once:
            // a single INSERT cannot update the same row twice.
            const distinctRiotIds = riotIds.filter(
                (riotId, index) =>
                    riotIds.findIndex(
                        (other) =>
                            other.gameName === riotId.gameName && other.tagLine === riotId.tagLine,
                    ) === index,
            );

            await transaction
                .insert(summonerRiotIds)
                .values(
                    distinctRiotIds.map((riotId) => ({
                        ...riotId,
                        region: profile.region,
                        puuid: profile.puuid,
                    })),
                )
                .onConflictDoUpdate({
                    target: [
                        summonerRiotIds.region,
                        summonerRiotIds.gameName,
                        summonerRiotIds.tagLine,
                    ],
                    set: { puuid: profile.puuid },
                });

            return row;
        });
    }
}
