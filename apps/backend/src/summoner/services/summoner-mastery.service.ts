import type { ChampionMastery, EPlatformRegion, RiotIdLookup } from '@lynf/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type { SummonerMasteryRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotChampionMasteryResponse } from '../../riot/types/riot-responses';
import { SummonerMasteryRepository } from '../repositories/summoner-mastery.repository';
import { withFreshnessFallback } from '../utils/riot-freshness.utils';
import { SummonerService } from './summoner.service';

/**
 * Business logic for champion masteries.
 *
 * Like ranked standings, all this needs from the player's profile is a puuid and a
 * `summoners` row to satisfy the foreign key on `summoner_masteries` — not a fresh
 * profile. Whatever is already stored answers both, however old it is; the full
 * resolution through the profile service is only asked for the first time a player is
 * ever seen, and it is `SummonerService.resolvePlayer` that runs it: the single
 * resolution every route shares, deduped there against the identical requests ranks,
 * masteries and matches fire in the same breath for a player none of them has seen
 * before.
 */
@Injectable()
export class SummonerMasteryService {
    private readonly logger = new Logger(SummonerMasteryService.name);

    constructor(
        private readonly summonerService: SummonerService,
        private readonly summonerMasteryRepository: SummonerMasteryRepository,
        private readonly riotExternal: RiotExternal,
        @Inject(ENVIRONMENT) private readonly environment: Environment,
    ) {}

    async findByRiotId(lookup: RiotIdLookup): Promise<ChampionMastery[]> {
        const { region } = lookup;
        const { puuid, gameName, tagLine } = await this.summonerService.resolvePlayer(lookup);

        const readAt = await this.summonerMasteryRepository.findReadAt(puuid, region);

        return withFreshnessFallback({
            fallback: readAt ?? undefined,
            isFresh: (at) => this.isFresh(at),
            serveStored: async () => {
                const stored = await this.summonerMasteryRepository.findByPuuid(puuid, region);
                return stored.map(toMastery);
            },
            refresh: async () => {
                const entries = await this.riotExternal.getTopChampionMasteriesByPuuid(
                    puuid,
                    region,
                );
                const rows = entries.map((entry) => toRow(entry, puuid, region));
                const saved = await this.summonerMasteryRepository.replaceAll(
                    puuid,
                    region,
                    rows,
                    new Date(),
                );

                return saved.map(toMastery);
            },
            logFallback: (_at, error) => {
                this.logger.warn(
                    `Serving the stored masteries of ${gameName}#${tagLine} on ${region}: Riot could not refresh them (${error.getStatus()}).`,
                );
            },
        });
    }

    private isFresh(readAt: Date) {
        const ageInSeconds = (Date.now() - readAt.getTime()) / 1000;
        return ageInSeconds < this.environment.SUMMONER_MASTERIES_TTL_SECONDS;
    }
}

function toRow(entry: RiotChampionMasteryResponse, puuid: string, region: EPlatformRegion) {
    return {
        puuid,
        region,
        championId: entry.championId,
        championLevel: entry.championLevel,
        championPoints: entry.championPoints,
        lastPlayTime: new Date(entry.lastPlayTime),
    };
}

/** Rows carry a `Date`; the contract carries an ISO string. */
function toMastery(row: SummonerMasteryRow): ChampionMastery {
    return {
        championId: row.championId,
        championLevel: row.championLevel,
        championPoints: row.championPoints,
        lastPlayTime: row.lastPlayTime.toISOString(),
    };
}
