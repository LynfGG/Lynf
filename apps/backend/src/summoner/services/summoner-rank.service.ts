import type { EPlatformRegion, RiotIdLookup, SummonerProfile, SummonerRank } from '@lynf/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type { SummonerRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import { SummonerRepository } from '../repositories/summoner.repository';
import { SummonerService } from './summoner.service';

@Injectable()
export class SummonerRankService {
    private readonly logger = new Logger(SummonerRankService.name);

    constructor(
        private readonly summonerService: SummonerService,
        private readonly summonerRepository: SummonerRepository,
        private readonly riotExternal: RiotExternal,
        @Inject(ENVIRONMENT) private readonly environment: Environment,
    ) {}

    async findByRiotId(lookup: RiotIdLookup): Promise<SummonerRank> {
        const profile = await this.summonerService.resolvePlayer(lookup);
        const leagueEntries = await this.riotExternal.getLeagueEntriesByPuid(
            profile.puuid,
            lookup.region,
        );
        return leagueEntries;
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
