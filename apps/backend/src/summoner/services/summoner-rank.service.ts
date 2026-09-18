import type { EPlatformRegion, RiotIdLookup, SummonerRank } from '@lynf/shared';
import { ERankedQueue, RANKED_QUEUES } from '@lynf/shared';
import { HttpException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type { SummonerRankRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotLeagueEntryResponse } from '../../riot/types/riot-responses';
import { SummonerRankRepository } from '../repositories/summoner-rank.repository';
import { SummonerService } from './summoner.service';

const SHOWN_QUEUES: readonly string[] = RANKED_QUEUES;

/**
 * Business logic for ranked standings.
 *
 * The profile service resolves the player first: it yields the puuid and, as a
 * side effect, guarantees the summoner row exists — the foreign key would refuse
 * the write otherwise.
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
        const profile = await this.summonerService.findByRiotId(lookup);
        const { puuid, region } = profile;

        const readAt = await this.summonerRankRepository.findReadAt(puuid, region);

        if (readAt && this.isFresh(readAt)) {
            const stored = await this.summonerRankRepository.findByPuuid(puuid, region);
            return sortByQueue(stored.map(toRank));
        }

        try {
            const entries = await this.riotExternal.getLeagueEntriesByPuuid(puuid, region);
            const rows = entries.filter(isShown).map((entry) => toRow(entry, puuid, region));
            const saved = await this.summonerRankRepository.replaceAll(
                puuid,
                region,
                rows,
                new Date(),
            );

            return sortByQueue(saved.map(toRank));
        } catch (error) {
            // Nothing was ever read, so there is no honest fallback: answering "unranked"
            // to a Master player would be a lie. A failure that is not Riot's — a database
            // error — must not be hidden either.
            if (
                !readAt ||
                !(error instanceof HttpException) ||
                error instanceof NotFoundException
            ) {
                throw error;
            }

            this.logger.warn(
                `Serving the stored standings of ${profile.gameName}#${profile.tagLine} on ${region}: Riot could not refresh them (${error.getStatus()}).`,
            );

            const stored = await this.summonerRankRepository.findByPuuid(puuid, region);
            return sortByQueue(stored.map(toRank));
        }
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
