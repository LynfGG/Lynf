import type { MatchTimeline, RiotIdLookup } from '@lynf/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

import type { MatchTimelineRow } from '../../database/schema/index';
import { RiotExternal } from '../../riot/externals/riot.external';
import { MatchTimelineRepository } from '../repositories/match-timeline.repository';
import { MatchRepository } from '../repositories/match.repository';
import { extractMatchTimeline } from '../utils/match-timeline-extraction.utils';
import { SummonerService } from './summoner.service';

/**
 * Business logic for one match's timeline.
 *
 * Unlike every other resource in this module, a timeline has no freshness dimension:
 * `withFreshnessFallback` — built for a value that goes stale and falls back to a stale
 * answer when Riot cannot refresh it — does not apply here. A timeline is immutable the
 * moment it exists, so there is nothing to refresh and nothing to fall back to: it is
 * either already stored (served straight from storage), or it is not (fetched once,
 * stored, and never fetched again). That is the storage-first shape of commit 8362cb4,
 * applied to a resource with no TTL at all rather than one whose TTL merely has not
 * expired yet.
 *
 * A timeline is only ever requested for a match already in `matches` — reached, in
 * practice, from a match this player's own history surfaced — so this needs the same
 * player resolution ranks, masteries and match history call: `SummonerService
 * .resolvePlayer`, the single deduped resolution of commit da02b88, never a second copy
 * of it.
 */
@Injectable()
export class MatchTimelineService {
    constructor(
        private readonly summonerService: SummonerService,
        private readonly matchRepository: MatchRepository,
        private readonly matchTimelineRepository: MatchTimelineRepository,
        private readonly riotExternal: RiotExternal,
    ) {}

    async findByMatchId(lookup: RiotIdLookup, matchId: string): Promise<MatchTimeline> {
        await this.summonerService.resolvePlayer(lookup);

        const stored = await this.matchTimelineRepository.findByMatchId(matchId);

        if (stored) {
            return toTimeline(stored);
        }

        const match = await this.matchRepository.findById(matchId);

        if (!match) {
            throw new NotFoundException(`Match ${matchId} is not known.`);
        }

        const raw = await this.riotExternal.getMatchTimeline(matchId, lookup.region);
        const extracted = extractMatchTimeline(raw);
        await this.matchTimelineRepository.insert(extracted);

        return toTimeline(extracted);
    }
}

function toTimeline(row: MatchTimelineRow): MatchTimeline {
    return {
        matchId: row.matchId,
        frames: row.frames,
        skillLevelUps: row.skillLevelUps,
        itemEvents: row.itemEvents,
        kills: row.kills,
    };
}
