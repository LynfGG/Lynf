import {
    MATCH_HISTORY_LIMIT,
    type EPlatformRegion,
    type MatchParticipantSummary,
    type MatchSummary,
    type RiotIdLookup,
} from '@lynf/shared';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type {
    MatchParticipantRow,
    NewMatchParticipantRow,
    NewMatchRow,
} from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import type { RiotMatchResponse } from '../../riot/types/riot-responses';
import { MatchRepository, type MatchWithPlayerRow } from '../repositories/match.repository';
import { withFreshnessFallback } from '../utils/riot-freshness.utils';
import { SummonerService } from './summoner.service';

/**
 * Business logic for match history — the riskiest data Lynf serves, because a mistake
 * here costs Riot quota rather than pixels.
 *
 * The one fact everything follows from: a finished match never changes, so a match
 * already stored is never asked of Riot again. What *does* go stale is the *list* of
 * match ids — "has this player played since last time?" — and that list alone is
 * governed by `SUMMONER_MATCHES_TTL_SECONDS`, the same freshness-and-fallback shape
 * ranks and masteries already use. A stale list still costs nothing extra: every id it
 * returns is filtered against storage before Riot is ever asked for a single match, so
 * a list re-read where nothing changed costs one call and zero match fetches.
 *
 * The puuid this needs is resolved by `SummonerService.resolvePlayer` — the same single,
 * deduped resolution ranks and masteries call, rather than a fourth copy of it here.
 */
@Injectable()
export class SummonerMatchService {
    private readonly logger = new Logger(SummonerMatchService.name);

    constructor(
        private readonly summonerService: SummonerService,
        private readonly matchRepository: MatchRepository,
        private readonly riotExternal: RiotExternal,
        @Inject(ENVIRONMENT) private readonly environment: Environment,
    ) {}

    async findByRiotId(lookup: RiotIdLookup): Promise<MatchSummary[]> {
        const { region } = lookup;
        const { puuid, gameName, tagLine } = await this.summonerService.resolvePlayer(lookup);

        const readAt = await this.matchRepository.findReadAt(puuid, region);

        return withFreshnessFallback({
            fallback: readAt ?? undefined,
            isFresh: (at) => this.isFresh(at),
            serveStored: () => this.buildSummaries(puuid),
            refresh: async () => {
                await this.ingest(puuid, region);
                return this.buildSummaries(puuid);
            },
            logFallback: (_at, error) => {
                this.logger.warn(
                    `Serving the stored matches of ${gameName}#${tagLine} on ${region}: Riot could not refresh the match list (${error.getStatus()}).`,
                );
            },
        });
    }

    private isFresh(readAt: Date) {
        const ageInSeconds = (Date.now() - readAt.getTime()) / 1000;
        return ageInSeconds < this.environment.SUMMONER_MATCHES_TTL_SECONDS;
    }

    /**
     * Reads the current match id list, then fetches only the matches not already
     * stored — bounded to `MATCH_HISTORY_LIMIT`, and only ever the difference against
     * storage, never the whole list blindly.
     *
     * Per-match failures are never allowed to undo matches already fetched in this same
     * run: each match is stored the moment it is fetched, not batched until the end.
     * A rate limit reached partway stops the loop rather than throwing — what is
     * already stored stays stored, and the rest is retried on the next refresh, once
     * the match list itself is stale again.
     */
    private async ingest(puuid: string, region: EPlatformRegion): Promise<void> {
        const ids = await this.riotExternal.getMatchIdsByPuuid(puuid, region, MATCH_HISTORY_LIMIT);
        const known = await this.matchRepository.findExistingMatchIds(ids);
        const unknown = ids.filter((id) => !known.has(id));

        // Fetched one at a time, deliberately: a development key is limited per second
        // as much as per window, and firing every unknown match at once would risk a
        // 429 on this call and every other route sharing the same key.
        for (const matchId of unknown) {
            try {
                const raw = await this.riotExternal.getMatchById(matchId, region);
                const { match, participants } = toRows(raw);
                await this.matchRepository.insertMatch(match, participants);
            } catch (error) {
                if (!(error instanceof HttpException)) {
                    throw error;
                }

                this.logger.warn(
                    `Stopped ingesting matches for ${puuid} on ${region} at ${matchId} (${error.getStatus()}). ${unknown.length} matches were unknown; matches already fetched this run are kept, the rest will be retried later.`,
                );
                break;
            }
        }

        // The list itself was successfully read, whatever happened to individual
        // matches after that — dating it is what keeps the next view from asking Riot
        // again before there is any chance a new match exists.
        await this.matchRepository.markListRead(puuid, region, new Date());
    }

    private async buildSummaries(puuid: string): Promise<MatchSummary[]> {
        const rows = await this.matchRepository.findRecentByPuuid(puuid, MATCH_HISTORY_LIMIT);

        if (rows.length === 0) {
            return [];
        }

        const matchIds = rows.map(({ match }) => match.matchId);
        const participantsByMatch = groupByMatchId(
            await this.matchRepository.findParticipantsByMatchIds(matchIds),
        );

        return rows.map((row) => toSummary(row, participantsByMatch.get(row.match.matchId) ?? []));
    }
}

function groupByMatchId(participants: MatchParticipantRow[]): Map<string, MatchParticipantRow[]> {
    const byMatch = new Map<string, MatchParticipantRow[]>();

    for (const participant of participants) {
        const group = byMatch.get(participant.matchId);

        if (group) {
            group.push(participant);
        } else {
            byMatch.set(participant.matchId, [participant]);
        }
    }

    return byMatch;
}

/**
 * The player who held the same lane on the other team, or `undefined` when
 * `teamPosition` is empty — some queues and old matches never carry it — or when no
 * other participant shares it. Either way, the match is still shown; only the duel
 * column is missing.
 */
function findOpponent(
    player: MatchParticipantRow,
    participants: MatchParticipantRow[],
): MatchParticipantRow | undefined {
    if (player.teamPosition === '') {
        return undefined;
    }

    return participants.find(
        (participant) =>
            participant.teamId !== player.teamId &&
            participant.teamPosition === player.teamPosition,
    );
}

function toSummary(
    { match, player }: MatchWithPlayerRow,
    participants: MatchParticipantRow[],
): MatchSummary {
    const opponent = findOpponent(player, participants);

    return {
        matchId: match.matchId,
        queueId: match.queueId,
        durationSeconds: match.durationSeconds,
        endedAt: match.endedAt.toISOString(),
        player: toParticipantSummary(player),
        opponent: opponent ? toParticipantSummary(opponent) : null,
        // Every participant Riot reported for this match, the tracked player and their
        // opponent included: this is what the expanded two-team detail is built from.
        // It is already in storage — no extra Riot call follows from returning it.
        participants: participants.map(toParticipantSummary),
    };
}

function toParticipantSummary(row: MatchParticipantRow): MatchParticipantSummary {
    return {
        puuid: row.puuid,
        riotIdGameName: row.riotIdGameName,
        riotIdTagline: row.riotIdTagline,
        teamId: row.teamId,
        teamPosition: row.teamPosition,
        championId: row.championId,
        win: row.win,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        creepScore: row.creepScore,
        goldEarned: row.goldEarned,
        totalDamageDealtToChampions: row.totalDamageDealtToChampions,
        items: row.items,
    };
}

/** Riot's raw match shape, turned into the two rows `MatchRepository.insertMatch` needs. */
function toRows(raw: RiotMatchResponse): {
    match: NewMatchRow;
    participants: NewMatchParticipantRow[];
} {
    const { metadata, info } = raw;

    const match: NewMatchRow = {
        matchId: metadata.matchId,
        platformId: info.platformId,
        queueId: info.queueId,
        durationSeconds: info.gameDuration,
        endedAt: new Date(info.gameEndTimestamp),
        gameVersion: info.gameVersion,
    };

    const participants: NewMatchParticipantRow[] = info.participants.map((participant) => ({
        matchId: metadata.matchId,
        puuid: participant.puuid,
        teamId: participant.teamId,
        championId: participant.championId,
        teamPosition: participant.teamPosition,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        creepScore: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        goldEarned: participant.goldEarned,
        totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
        items: [
            participant.item0,
            participant.item1,
            participant.item2,
            participant.item3,
            participant.item4,
            participant.item5,
            participant.item6,
        ],
        riotIdGameName: participant.riotIdGameName,
        riotIdTagline: participant.riotIdTagline,
    }));

    return { match, participants };
}
