import type { EPlatformRegion, RiotIdLookup, SummonerRank } from '@lynf/shared';
import { ERankedQueue, RANKED_QUEUES } from '@lynf/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type { SummonerRankRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotLeagueEntryResponse } from '../../riot/types/riot-responses';
import { SummonerRankRepository } from '../repositories/summoner-rank.repository';
import { withFreshnessFallback } from '../utils/riot-freshness.utils';
import { SummonerService } from './summoner.service';

const SHOWN_QUEUES: readonly string[] = RANKED_QUEUES;

/**
 * Business logic for ranked standings.
 *
 * All this needs from the player's profile is a puuid, and a `summoners` row to
 * satisfy the foreign key on `summoner_ranks` — not a fresh profile. A puuid never
 * changes, so whatever is already stored answers both, however old it is. The full
 * resolution through the profile service — account-v1, then summoner-v4 — is only
 * asked for the first time a player is ever seen, when nothing is stored yet, and it
 * is `SummonerService.resolvePlayer` that runs it: the single resolution every route
 * shares, deduped there against the identical requests ranks, masteries and matches
 * fire in the same breath for a player none of them has seen before.
 */
@Injectable()
export class SummonerRankService {
    private readonly logger = new Logger(SummonerRankService.name);

    constructor(
        private readonly summonerService: SummonerService,
        private readonly summonerRankRepository: SummonerRankRepository,
        private readonly riotExternal: RiotExternal,
        @Inject(ENVIRONMENT) private readonly environment: Environment,
    ) {}

    async findByRiotId(lookup: RiotIdLookup): Promise<SummonerRank[]> {
        const { region } = lookup;
        const { puuid, gameName, tagLine } = await this.summonerService.resolvePlayer(lookup);

        const readAt = await this.summonerRankRepository.findReadAt(puuid, region);

        return withFreshnessFallback({
            fallback: readAt ?? undefined,
            isFresh: (at) => this.isFresh(at),
            serveStored: async () => {
                const stored = await this.summonerRankRepository.findByPuuid(puuid, region);
                return sortByQueue(stored.map(toRank));
            },
            refresh: async () => {
                const entries = await this.riotExternal.getLeagueEntriesByPuuid(puuid, region);
                const rows = entries.filter(isShown).map((entry) => toRow(entry, puuid, region));
                const saved = await this.summonerRankRepository.replaceAll(
                    puuid,
                    region,
                    rows,
                    new Date(),
                );

                return sortByQueue(saved.map(toRank));
            },
            logFallback: (_at, error) => {
                this.logger.warn(
                    `Serving the stored standings of ${gameName}#${tagLine} on ${region}: Riot could not refresh them (${error.getStatus()}).`,
                );
            },
        });
    }

    private isFresh(readAt: Date) {
        const ageInSeconds = (Date.now() - readAt.getTime()) / 1000;
        return ageInSeconds < this.environment.SUMMONER_RANKS_TTL_SECONDS;
    }
}

/** Riot answers for queues Lynf does not show — Arena among them. */
function isShown(entry: RiotLeagueEntryResponse) {
    return SHOWN_QUEUES.includes(entry.queueType);
}

function toRow(entry: RiotLeagueEntryResponse, puuid: string, region: EPlatformRegion) {
    return {
        puuid,
        region,
        queue: entry.queueType,
        tier: entry.tier,
        division: entry.rank,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
    };
}

/** Rows carry Riot's spelling; the contract carries the shared queue type. */
function toRank(row: SummonerRankRow): SummonerRank {
    return {
        queue: row.queue as ERankedQueue,
        tier: row.tier,
        division: row.division,
        leaguePoints: row.leaguePoints,
        wins: row.wins,
        losses: row.losses,
    };
}

/**
 * Both the stored-standings path and the Riot-refresh path reach this, so the two agree
 * on an order instead of each leaving it to storage or Riot's own response order.
 */
function sortByQueue(ranks: SummonerRank[]): SummonerRank[] {
    return [...ranks].sort(
        (a, b) => RANKED_QUEUES.indexOf(a.queue) - RANKED_QUEUES.indexOf(b.queue),
    );
}
