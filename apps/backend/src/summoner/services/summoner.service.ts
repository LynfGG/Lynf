import {
    normalizeRiotId,
    type EPlatformRegion,
    type RiotIdLookup,
    type SummonerProfile,
} from '@lynf/shared';
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
 *
 * This is also the one place the whole application resolves a Riot ID into a puuid.
 * `resolvePlayer` is what ranks, masteries and matches call for that; a profile route
 * calling `findByRiotId` directly reaches the exact same resolution.
 */
@Injectable()
export class SummonerService {
    private readonly logger = new Logger(SummonerService.name);

    /**
     * Riot identification in flight, keyed by normalised Riot ID. A profile page fires
     * its four routes at once, and every one of them ends up here for a player never
     * seen before — without this, that is four account-v1 and four summoner-v4 calls
     * instead of one each, against a key limited to a hundred calls per two minutes.
     *
     * An entry lives only for the duration of its own resolution: the `finally` below
     * removes it the moment the promise settles, on success or on failure alike. A
     * failed resolution must never stay memoised — a mistyped Riot ID would otherwise
     * turn one 404 into a poisoned entry that answers every later attempt with the same
     * 404 until the process restarts. A successful resolution does not need to stay
     * either: it just wrote the profile to storage, so the very next lookup — for the
     * same Riot ID or any other route — is answered by storage, not by this map. So the
     * map never holds more than the resolutions genuinely in flight right now, which is
     * also what keeps it safe as a cache keyed on user input: nothing here outlives the
     * request that produced it, so nothing from one caller's input can leak into a
     * later caller's answer.
     */
    private readonly resolutionsInFlight = new Map<string, Promise<SummonerProfile>>();

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
            refresh: () => this.refreshDeduped(lookup),
            logFallback: (row, error) => {
                this.logger.warn(
                    `Serving the stored profile of ${row.gameName}#${row.tagLine} on ${row.region}: Riot could not refresh it (${error.getStatus()}).`,
                );
            },
        });
    }

    /**
     * Yields the puuid a Riot ID resolves to, and enough of the identity to log with —
     * the one thing ranks, masteries and matches need from a profile, and the only
     * reason `summoner-rank.service.ts`, `summoner-mastery.service.ts` and
     * `summoner-match.service.ts` used to each carry their own byte-identical copy of
     * this method. A stored row already answers it, whatever its age, since a puuid
     * never changes; only a player never seen before reaches `findByRiotId` below, and
     * so the same in-flight dedup it applies.
     */
    async resolvePlayer(
        lookup: RiotIdLookup,
    ): Promise<Pick<SummonerProfile, 'puuid' | 'gameName' | 'tagLine'>> {
        const stored = await this.summonerRepository.findByRiotId(lookup);

        if (stored) {
            return { puuid: stored.puuid, gameName: stored.gameName, tagLine: stored.tagLine };
        }

        const { puuid, gameName, tagLine } = await this.findByRiotId(lookup);
        return { puuid, gameName, tagLine };
    }

    /**
     * Runs `refresh` at most once per Riot ID at a time. A second caller for the same
     * key while one is already running gets handed that same promise instead of
     * starting another round trip; once it settles, the key is free again.
     */
    private refreshDeduped(lookup: RiotIdLookup): Promise<SummonerProfile> {
        const key = resolutionKey(lookup);
        const inFlight = this.resolutionsInFlight.get(key);

        if (inFlight) {
            return inFlight;
        }

        const resolution = this.refresh(lookup).finally(() => {
            this.resolutionsInFlight.delete(key);
        });

        this.resolutionsInFlight.set(key, resolution);
        return resolution;
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

/**
 * Riot IDs ignore case, so the dedup key must too — otherwise `Faker#KR1` and
 * `faker#kr1` in flight at the same time would be treated as two different players
 * instead of the one resolution they actually are.
 *
 * The three parts are JSON-encoded into an array rather than joined with a plain
 * separator: `gameName` and `tagLine` arrive straight from a URL segment, where `:`
 * is a legal character, so `${region}:${gameName}:${tagLine}` can collide — a
 * `gameName` of `abc:d` with a `tagLine` of `efg` produces the same string as a
 * `gameName` of `abc` with a `tagLine` of `d:efg`, two distinct, valid Riot IDs.
 * `JSON.stringify` escapes quotes and backslashes inside each part, so no value any
 * of the three fields can take produces the same key as a different triple.
 */
function resolutionKey({ region, gameName, tagLine }: RiotIdLookup): string {
    const normalized = normalizeRiotId(gameName, tagLine);
    return JSON.stringify([region, normalized.gameName, normalized.tagLine]);
}
