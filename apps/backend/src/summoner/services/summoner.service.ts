import type { EPlatformRegion, RiotIdLookup, SummonerProfile } from '@lynf/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type { SummonerRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import { SummonerRepository } from '../repositories/summoner.repository';
import { withFreshnessFallback } from '../utils/riot-freshness.utils';

/**
 * Business logic for player profiles.
 *
 * Two decisions live here. A stored profile is served as-is while it is fresh, and Riot
 * is only asked again once it is not. And when Riot cannot answer — rejected key, rate
 * limit, outage — a stored profile is served anyway, whatever its age: a development key
 * expires every 24 hours and rate limits are tight, so a profile page must never depend
 * on a Riot call succeeding right now.
 */
@Injectable()
export class SummonerService {
    private readonly logger = new Logger(SummonerService.name);

    constructor(
        private readonly summonerRepository: SummonerRepository,
        private readonly riotExternal: RiotExternal,
        @Inject(ENVIRONMENT) private readonly environment: Environment,
    ) {}

    async findByRiotId(lookup: RiotIdLookup): Promise<SummonerProfile> {
        const stored = await this.summonerRepository.findByRiotId(lookup);

        return withFreshnessFallback({
            fallback: stored,
            isFresh: (row) => this.isFresh(row),
            serveStored: (row) => Promise.resolve(this.toProfile(row)),
            refresh: () => this.refresh(lookup),
            logFallback: (row, error) => {
                this.logger.warn(
                    `Serving the stored profile of ${row.gameName}#${row.tagLine} on ${row.region}: Riot could not refresh it (${error.getStatus()}).`,
                );
            },
        });
    }

    private async refresh(lookup: RiotIdLookup) {
        const account = await this.riotExternal.getAccountByRiotId(lookup);
        const summoner = await this.riotExternal.getSummonerByPuuid(account.puuid, lookup.region);

        const saved = await this.summonerRepository.save(
            {
                puuid: account.puuid,
                region: lookup.region,
                gameName: account.gameName,
                tagLine: account.tagLine,
                profileIconId: summoner.profileIconId,
                summonerLevel: summoner.summonerLevel,
                updatedAt: new Date(),
            },
            lookup,
        );

        this.logger.log(`Refreshed ${account.gameName}#${account.tagLine} on ${lookup.region}`);

        return this.toProfile(saved);
    }

    private isFresh(row: SummonerRow) {
        const ageInSeconds = (Date.now() - row.updatedAt.getTime()) / 1000;
        return ageInSeconds < this.environment.SUMMONER_PROFILE_TTL_SECONDS;
    }

    /** Rows carry a `Date`; the API contract carries an ISO string. */
    private toProfile(row: SummonerRow): SummonerProfile {
        return {
            puuid: row.puuid,
            gameName: row.gameName,
            tagLine: row.tagLine,
            region: row.region as EPlatformRegion,
            profileIconId: row.profileIconId,
            summonerLevel: row.summonerLevel,
            updatedAt: row.updatedAt.toISOString(),
        };
    }
}
