import { EPlatformRegion, PLATFORM_REGIONS } from '@lynf/shared';
import {
    BadGatewayException,
    HttpStatus,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';

import type { Environment } from '../../config/environment';
import { RiotExternal } from './riot.external';

const ENVIRONMENT = { RIOT_API_KEY: 'test-key' } as Environment;

const FAKER = { region: EPlatformRegion.KR, gameName: 'Faker', tagLine: 'KR1' };

/** The account cluster every platform must be routed to. */
const ACCOUNT_CLUSTERS: [EPlatformRegion, string][] = [
    [EPlatformRegion.EUW, 'europe'],
    [EPlatformRegion.EUNE, 'europe'],
    [EPlatformRegion.TR, 'europe'],
    [EPlatformRegion.RU, 'europe'],
    [EPlatformRegion.NA, 'americas'],
    [EPlatformRegion.BR, 'americas'],
    [EPlatformRegion.LAN, 'americas'],
    [EPlatformRegion.LAS, 'americas'],
    [EPlatformRegion.KR, 'asia'],
    [EPlatformRegion.JP, 'asia'],
    [EPlatformRegion.OCE, 'asia'],
    [EPlatformRegion.PH, 'asia'],
    [EPlatformRegion.SG, 'asia'],
    [EPlatformRegion.TH, 'asia'],
    [EPlatformRegion.TW, 'asia'],
    [EPlatformRegion.VN, 'asia'],
];

/**
 * The match-v5 cluster every platform must be routed to — deliberately different from
 * `ACCOUNT_CLUSTERS` above for OCE, PH, SG, TH, TW and VN, which match-v5 routes to
 * `sea` while account-v1 still routes them to `asia`.
 */
const MATCH_CLUSTERS: [EPlatformRegion, string][] = [
    [EPlatformRegion.EUW, 'europe'],
    [EPlatformRegion.EUNE, 'europe'],
    [EPlatformRegion.TR, 'europe'],
    [EPlatformRegion.RU, 'europe'],
    [EPlatformRegion.NA, 'americas'],
    [EPlatformRegion.BR, 'americas'],
    [EPlatformRegion.LAN, 'americas'],
    [EPlatformRegion.LAS, 'americas'],
    [EPlatformRegion.KR, 'asia'],
    [EPlatformRegion.JP, 'asia'],
    [EPlatformRegion.OCE, 'sea'],
    [EPlatformRegion.PH, 'sea'],
    [EPlatformRegion.SG, 'sea'],
    [EPlatformRegion.TH, 'sea'],
    [EPlatformRegion.TW, 'sea'],
    [EPlatformRegion.VN, 'sea'],
];

function respondWith(status: number, body: unknown = {}): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(),
        json: async () => body,
    } as Response;
}

describe('RiotExternal', () => {
    let external: RiotExternal;
    let fetchMock: jest.Mock;
    let errorLog: jest.SpyInstance;
    let warnLog: jest.SpyInstance;

    const requestedUrl = () => fetchMock.mock.calls[0][0] as string;

    beforeEach(() => {
        external = new RiotExternal(ENVIRONMENT);
        fetchMock = jest.fn().mockResolvedValue(respondWith(HttpStatus.OK));
        global.fetch = fetchMock as unknown as typeof fetch;

        // What the external logs is part of its behaviour: it is asserted, and kept out of
        // the test output. The per-call log line is not asserted here — it exists to make
        // Riot's quota countable from real logs, not from a unit test — but it is just as
        // noisy, so it is silenced the same way.
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
        warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns the account when Riot answers', async () => {
        const account = { puuid: 'p-1', gameName: 'Faker', tagLine: 'KR1' };
        fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, account));

        await expect(external.getAccountByRiotId(FAKER)).resolves.toEqual(account);
    });

    it('asks the account cluster for the Riot ID, encoded', async () => {
        await external.getAccountByRiotId({
            region: EPlatformRegion.KR,
            gameName: 'Hide on bush',
            tagLine: 'KR1',
        });

        expect(requestedUrl()).toBe(
            'https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Hide%20on%20bush/KR1',
        );
    });

    it.each(ACCOUNT_CLUSTERS)(
        'routes account lookups on %s to the %s cluster',
        async (region, cluster) => {
            await external.getAccountByRiotId({ ...FAKER, region });

            expect(requestedUrl().startsWith(`https://${cluster}.api.riotgames.com/`)).toBe(true);
        },
    );

    it('has a cluster test for every platform', () => {
        const tested = ACCOUNT_CLUSTERS.map(([region]) => region);

        expect([...tested].sort()).toEqual([...PLATFORM_REGIONS].sort());
    });

    it('asks the platform host for the summoner, encoded', async () => {
        await external.getSummonerByPuuid('p/1', EPlatformRegion.EUW);

        expect(requestedUrl()).toBe(
            'https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/p%2F1',
        );
    });

    it('sends the API key as a header, never in the URL', async () => {
        await external.getSummonerByPuuid('p-1', EPlatformRegion.EUW);

        const [url, options] = fetchMock.mock.calls[0];
        expect(options.headers['X-Riot-Token']).toBe('test-key');
        expect(url).not.toContain('test-key');
    });

    it('gives every request a deadline', async () => {
        await external.getSummonerByPuuid('p-1', EPlatformRegion.EUW);

        const [, options] = fetchMock.mock.calls[0];
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('turns a 404 into a NotFoundException', async () => {
        fetchMock.mockResolvedValue(respondWith(HttpStatus.NOT_FOUND));

        await expect(external.getAccountByRiotId(FAKER)).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
        [HttpStatus.UNAUTHORIZED, 'does not recognise the API key (401)'],
        [HttpStatus.FORBIDDEN, 'refused the API key (403)'],
    ])('turns a rejected key (%s) into a 502, and says why', async (status, explanation) => {
        fetchMock.mockResolvedValue(respondWith(status));

        await expect(external.getAccountByRiotId(FAKER)).rejects.toBeInstanceOf(
            BadGatewayException,
        );
        expect(errorLog).toHaveBeenCalledWith(expect.stringContaining(explanation));
        expect(JSON.stringify(errorLog.mock.calls)).not.toContain('test-key');
    });

    it('surfaces a rate limit instead of swallowing it', async () => {
        fetchMock.mockResolvedValue(respondWith(HttpStatus.TOO_MANY_REQUESTS));

        await expect(external.getSummonerByPuuid('p-1', EPlatformRegion.EUW)).rejects.toMatchObject(
            { status: HttpStatus.TOO_MANY_REQUESTS },
        );
        expect(warnLog).toHaveBeenCalledWith(expect.stringContaining('rate limit'));
    });

    it('reports an unexpected Riot error as unavailable', async () => {
        fetchMock.mockResolvedValue(respondWith(HttpStatus.INTERNAL_SERVER_ERROR));

        await expect(
            external.getSummonerByPuuid('p-1', EPlatformRegion.EUW),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(errorLog).toHaveBeenCalledWith('Unexpected Riot response: 500');
    });

    it('reports a response it cannot read as unavailable', async () => {
        // The deadline also runs while the body is read.
        fetchMock.mockResolvedValue({
            ...respondWith(HttpStatus.OK),
            json: async () => {
                throw new DOMException('The operation timed out.', 'TimeoutError');
            },
        });

        await expect(
            external.getSummonerByPuuid('p-1', EPlatformRegion.EUW),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('could not be read'));
    });

    it('reports an unreachable Riot API as unavailable', async () => {
        fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(
            external.getSummonerByPuuid('p-1', EPlatformRegion.EUW),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('unreachable'));
    });

    describe('getLeagueEntriesByPuuid', () => {
        it('asks the platform host, with the API key', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, []));

            await external.getLeagueEntriesByPuuid('p-1', EPlatformRegion.EUW);

            expect(requestedUrl()).toBe(
                'https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/p-1',
            );
            const [, options] = fetchMock.mock.calls[0];
            expect(options.headers['X-Riot-Token']).toBe('test-key');
        });

        it('returns an empty list for a player who is not ranked', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, []));

            await expect(
                external.getLeagueEntriesByPuuid('p-1', EPlatformRegion.EUW),
            ).resolves.toEqual([]);
        });

        it('turns a rejected key into a 502', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.FORBIDDEN));

            await expect(
                external.getLeagueEntriesByPuuid('p-1', EPlatformRegion.EUW),
            ).rejects.toBeInstanceOf(BadGatewayException);
        });

        it('does not swallow a rate limit', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.TOO_MANY_REQUESTS));

            await expect(
                external.getLeagueEntriesByPuuid('p-1', EPlatformRegion.EUW),
            ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
        });
    });

    describe('getTopChampionMasteriesByPuuid', () => {
        it('asks the platform host for the top masteries, with the API key', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, []));

            await external.getTopChampionMasteriesByPuuid('p-1', EPlatformRegion.EUW);

            expect(requestedUrl()).toBe(
                'https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/p-1/top?count=3',
            );
            const [, options] = fetchMock.mock.calls[0];
            expect(options.headers['X-Riot-Token']).toBe('test-key');
        });

        it('returns an empty list for a player who has never played', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, []));

            await expect(
                external.getTopChampionMasteriesByPuuid('p-1', EPlatformRegion.EUW),
            ).resolves.toEqual([]);
        });

        it('turns a rejected key into a 502', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.FORBIDDEN));

            await expect(
                external.getTopChampionMasteriesByPuuid('p-1', EPlatformRegion.EUW),
            ).rejects.toBeInstanceOf(BadGatewayException);
        });

        it('does not swallow a rate limit', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.TOO_MANY_REQUESTS));

            await expect(
                external.getTopChampionMasteriesByPuuid('p-1', EPlatformRegion.EUW),
            ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
        });
    });

    describe('getMatchIdsByPuuid', () => {
        it('asks the match cluster for the ids, most recent first, with the API key', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, []));

            await external.getMatchIdsByPuuid('p-1', EPlatformRegion.EUW, 20);

            expect(requestedUrl()).toBe(
                'https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/p-1/ids?start=0&count=20',
            );
            const [, options] = fetchMock.mock.calls[0];
            expect(options.headers['X-Riot-Token']).toBe('test-key');
        });

        it('forwards the count it is given', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, []));

            await external.getMatchIdsByPuuid('p-1', EPlatformRegion.EUW, 3);

            expect(requestedUrl()).toContain('count=3');
        });

        it.each(MATCH_CLUSTERS)('routes match ids on %s to the %s cluster', async (region) => {
            const cluster = MATCH_CLUSTERS.find(([platform]) => platform === region)?.[1];
            await external.getMatchIdsByPuuid('p-1', region, 20);

            expect(requestedUrl().startsWith(`https://${cluster}.api.riotgames.com/`)).toBe(true);
        });

        it('routes OCE to sea for match-v5, unlike the asia it gets from account-v1', async () => {
            await external.getMatchIdsByPuuid('p-1', EPlatformRegion.OCE, 20);

            expect(requestedUrl().startsWith('https://sea.api.riotgames.com/')).toBe(true);
        });

        it('has a cluster test for every platform', () => {
            const tested = MATCH_CLUSTERS.map(([region]) => region);

            expect([...tested].sort()).toEqual([...PLATFORM_REGIONS].sort());
        });

        it('turns a rejected key into a 502', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.FORBIDDEN));

            await expect(
                external.getMatchIdsByPuuid('p-1', EPlatformRegion.EUW, 20),
            ).rejects.toBeInstanceOf(BadGatewayException);
        });

        it('does not swallow a rate limit', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.TOO_MANY_REQUESTS));

            await expect(
                external.getMatchIdsByPuuid('p-1', EPlatformRegion.EUW, 20),
            ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
        });
    });

    describe('getMatchById', () => {
        it('asks the match cluster for the match, encoded, with the API key', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.OK, {}));

            await external.getMatchById('EUW1_123/456', EPlatformRegion.EUW);

            expect(requestedUrl()).toBe(
                'https://europe.api.riotgames.com/lol/match/v5/matches/EUW1_123%2F456',
            );
            const [, options] = fetchMock.mock.calls[0];
            expect(options.headers['X-Riot-Token']).toBe('test-key');
        });

        it('routes to the match cluster, not the account one', async () => {
            await external.getMatchById('OC1_1', EPlatformRegion.OCE);

            expect(requestedUrl().startsWith('https://sea.api.riotgames.com/')).toBe(true);
        });

        it('turns a 404 into a NotFoundException', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.NOT_FOUND));

            await expect(
                external.getMatchById('EUW1_123', EPlatformRegion.EUW),
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('does not swallow a rate limit', async () => {
            fetchMock.mockResolvedValue(respondWith(HttpStatus.TOO_MANY_REQUESTS));

            await expect(
                external.getMatchById('EUW1_123', EPlatformRegion.EUW),
            ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
        });
    });
});
