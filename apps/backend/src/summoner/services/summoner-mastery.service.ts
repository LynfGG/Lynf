import type { ChampionMastery, EPlatformRegion, RiotIdLookup } from '@lynf/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type { SummonerMasteryRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotChampionMasteryResponse } from '../../riot/types/riot-responses';
import { SummonerMasteryRepository } from '../repositories/summoner-mastery.repository';
import { SummonerRepository } from '../repositories/summoner.repository';
import { withFreshnessFallback } from '../utils/riot-freshness.utils';
import { SummonerService } from './summoner.service';

/**
 * Business logic for champion masteries.
 *
 * Like ranked standings, all this needs from the player's profile is a puuid and a
 * `summoners` row to satisfy the foreign key on `summoner_masteries` — not a fresh
 * profile. Whatever is already stored answers both, however old it is; the full
 * resolution through the profile service is only asked for the first time a player is
 * ever seen.
 */
@Injectable()
export class SummonerMasteryService {
    private readonly logger = new Logger(SummonerMasteryService.name);

    constructor(
        private readonly summonerService: SummonerService,
        private readonly summonerRepository: SummonerRepository,
        private readonly summonerMasteryRepository: SummonerMasteryRepository,
        private readonly riotExternal: RiotExternal,
        @Inject(ENVIRONMENT) private readonly environment: Environment,
    ) {}

    async findByRiotId(lookup: RiotIdLookup): Promise<ChampionMastery[]> {
        const { region } = lookup;
        const { puuid, gameName, tagLine } = await this.resolvePlayer(lookup);

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

    /**
     * Yields the puuid this player is known under, and enough of their identity to log
     * with. A stored row already answers both, whatever its age, and also guarantees the
     * `summoners` row that `summoner_masteries` has a foreign key to. Only a player never
     * seen before goes through the full profile resolution.
     */
    private async resolvePlayer(lookup: RiotIdLookup) {
        const stored = await this.summonerRepository.findByRiotId(lookup);

        if (stored) {
            return { puuid: stored.puuid, gameName: stored.gameName, tagLine: stored.tagLine };
        }

        return this.summonerService.findByRiotId(lookup);
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
