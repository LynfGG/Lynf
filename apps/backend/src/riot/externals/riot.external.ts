import {
    BadGatewayException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import {
    TOP_CHAMPION_MASTERIES_COUNT,
    type EPlatformRegion,
    type RiotIdLookup,
} from '@lynf/shared';

import { ENVIRONMENT } from '../../config/config.module';
import type { Environment } from '../../config/environment';
import type {
    RiotAccountResponse,
    RiotChampionMasteryResponse,
    RiotLeagueEntryResponse,
    RiotMatchResponse,
    RiotSummonerResponse,
} from '../types/riot-responses';
import { accountClusterHost, matchClusterHost, platformHost } from '../utils/riot-routing.utils';

/** Past this, a Riot call is abandoned: a hanging request would otherwise hold the page for minutes. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * The boundary with the Riot API.
 *
 * It knows how to call Riot and how to turn its failures into NestJS exceptions.
 * It holds no business logic: deciding *when* to call it is the service's job.
 */
@Injectable()
export class RiotExternal {
    private readonly logger = new Logger(RiotExternal.name);

    constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

    /** Resolves a Riot ID (`gameName#tagLine`) to the account it identifies. */
    async getAccountByRiotId({
        region,
        gameName,
        tagLine,
    }: RiotIdLookup): Promise<RiotAccountResponse> {
        const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

        return this.request<RiotAccountResponse>(
            `${accountClusterHost(region)}${path}`,
            `No player named ${gameName}#${tagLine} exists.`,
        );
    }

    /** Reads the League profile an account has on one platform. */
    async getSummonerByPuuid(
        puuid: string,
        region: EPlatformRegion,
    ): Promise<RiotSummonerResponse> {
        const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;

        return this.request<RiotSummonerResponse>(
            `${platformHost(region)}${path}`,
            `This account has never played League of Legends on ${region}.`,
        );
    }

    /**
     * Reads every ranked standing an account holds on one platform.
     *
     * A player who has never been ranked is not an error: Riot answers `200` with an
     * empty array. Only an unknown account produces a 404.
     */
    async getLeagueEntriesByPuuid(
        puuid: string,
        region: EPlatformRegion,
    ): Promise<RiotLeagueEntryResponse[]> {
        const path = `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;

        return this.request<RiotLeagueEntryResponse[]>(
            `${platformHost(region)}${path}`,
            `This account has no League profile on ${region}.`,
        );
    }

    /**
     * Reads the most-played champions of an account on one platform, best first.
     *
     * `champion-mastery-v4` also exposes every mastery an account holds, but only the
     * top ones are ever shown, so only the top ones are ever asked for: a development
     * key is a rate-limited resource, not one to spend on rows that would be discarded.
     */
    async getTopChampionMasteriesByPuuid(
        puuid: string,
        region: EPlatformRegion,
    ): Promise<RiotChampionMasteryResponse[]> {
        const path = `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${TOP_CHAMPION_MASTERIES_COUNT}`;

        return this.request<RiotChampionMasteryResponse[]>(
            `${platformHost(region)}${path}`,
            `This account has no champion mastery on ${region}.`,
        );
    }

    /**
     * Reads the ids of the most recent matches an account played, most recent first.
     *
     * `count` is never let past `MATCH_HISTORY_LIMIT`: the caller enforces that, this
     * method just forwards whatever it is given. match-v5 routes by regional cluster,
     * not by platform — see `matchClusterHost` for the mapping, which differs from the
     * one account-v1 uses.
     */
    async getMatchIdsByPuuid(
        puuid: string,
        region: EPlatformRegion,
        count: number,
    ): Promise<string[]> {
        const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;

        return this.request<string[]>(
            `${matchClusterHost(region)}${path}`,
            `This account has no match history on ${region}.`,
        );
    }

    /**
     * Reads the full detail of one match.
     *
     * Called only for matches not already in storage: a finished match never changes,
     * so once fetched it is never fetched again.
     */
    async getMatchById(matchId: string, region: EPlatformRegion): Promise<RiotMatchResponse> {
        const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;

        return this.request<RiotMatchResponse>(
            `${matchClusterHost(region)}${path}`,
            `Match ${matchId} could not be found.`,
        );
    }

    private async request<T>(url: string, notFoundMessage: string) {
        let response: Response;

        try {
            response = await fetch(url, {
                headers: { 'X-Riot-Token': this.environment.RIOT_API_KEY },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (cause) {
            // The network failed, or Riot took longer than the timeout above.
            this.logger.error(`Riot API unreachable: ${String(cause)}`);
            throw new ServiceUnavailableException('The Riot API could not be reached.');
        }

        if (!response.ok) {
            throw this.toException(response, notFoundMessage);
        }

        try {
            return (await response.json()) as T;
        } catch (cause) {
            // The deadline also runs while the body is read, and a connection can drop halfway.
            this.logger.error(`Riot response could not be read: ${String(cause)}`);
            throw new ServiceUnavailableException('The Riot API could not be reached.');
        }
    }

    /**
     * Every failure Riot can return, mapped to something a caller can act on.
     *
     * A rejected key becomes a 502, never a 401: the key is the server's configuration, so
     * a 401 would wrongly tell the browser that *it* is not authenticated. A 429 is
     * surfaced rather than swallowed: hiding it would turn a rate limit into a silent
     * absence of data.
     */
    private toException(response: Response, notFoundMessage: string) {
        switch (response.status) {
            case HttpStatus.NOT_FOUND:
                return new NotFoundException(notFoundMessage);

            case HttpStatus.UNAUTHORIZED:
                // Riot answers 401 "Unknown apikey" for a key it never issued — most often one
                // regenerated after being copied, or mistyped. It says nothing about expiry.
                this.logger.error(
                    'Riot does not recognise the API key (401). Copy the key currently shown on the developer portal: regenerating it invalidates the previous one.',
                );
                return new BadGatewayException('The Riot API key was rejected.');

            case HttpStatus.FORBIDDEN:
                this.logger.error(
                    'Riot refused the API key (403): expired, or not allowed on this endpoint. Development keys expire every 24 hours.',
                );
                return new BadGatewayException('The Riot API key was rejected.');

            case HttpStatus.TOO_MANY_REQUESTS: {
                const retryAfter = response.headers.get('Retry-After');
                this.logger.warn(
                    `Riot rate limit reached. Retry-After: ${retryAfter ?? 'unknown'}`,
                );
                return new HttpException(
                    'The Riot API rate limit was reached. Try again shortly.',
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            default:
                this.logger.error(`Unexpected Riot response: ${response.status}`);
                return new ServiceUnavailableException(
                    'The Riot API returned an unexpected error.',
                );
        }
    }
}
