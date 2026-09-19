import { EPlatformRegion } from '@lynf/shared';
import {
    BadGatewayException,
    HttpException,
    HttpStatus,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';

import type { Environment } from '../../config/environment';
import type { SummonerRow } from '../../database/schema';
import type { RiotExternal } from '../../riot/externals/riot.external';
import type { SummonerRepository } from '../repositories/summoner.repository';
import { SummonerService } from './summoner.service';

const TTL_SECONDS = 600;
const ENVIRONMENT = { SUMMONER_PROFILE_TTL_SECONDS: TTL_SECONDS } as Environment;

const LOOKUP = { region: EPlatformRegion.EUW, gameName: 'faker', tagLine: 'kr1' };

function rowAgedSeconds(seconds: number): SummonerRow {
    return {
        puuid: 'p-1',
        region: EPlatformRegion.EUW,
        gameName: 'Faker',
        tagLine: 'KR1',
        profileIconId: 10,
        summonerLevel: 500,
        updatedAt: new Date(Date.now() - seconds * 1000),
    };
}

describe('SummonerService', () => {
    let repository: jest.Mocked<Pick<SummonerRepository, 'findByRiotId' | 'save'>>;
    let riot: jest.Mocked<Pick<RiotExternal, 'getAccountByRiotId' | 'getSummonerByPuuid'>>;
    let service: SummonerService;
    let infoLog: jest.SpyInstance;
    let warnLog: jest.SpyInstance;

    beforeEach(() => {
        repository = { findByRiotId: jest.fn(), save: jest.fn() };
        riot = { getAccountByRiotId: jest.fn(), getSummonerByPuuid: jest.fn() };
        service = new SummonerService(
            repository as unknown as SummonerRepository,
            riot as unknown as RiotExternal,
            ENVIRONMENT,
        );

        // By default Riot answers, and the repository stores whatever it is given.
        riot.getAccountByRiotId.mockResolvedValue({
            puuid: 'p-1',
            gameName: 'Faker',
            tagLine: 'KR1',
        });
        riot.getSummonerByPuuid.mockResolvedValue({
            puuid: 'p-1',
            profileIconId: 22,
            summonerLevel: 501,
            revisionDate: 0,
        });
        repository.save.mockImplementation(async (values) => ({
            ...rowAgedSeconds(0),
            ...values,
        }));

        // What the service logs is part of its behaviour: it is asserted, and kept out of
        // the test output.
        infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
        warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('while the stored profile is fresh', () => {
        it('serves it without calling Riot or writing anything', async () => {
            repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS - 1));

            const profile = await service.findByRiotId(LOOKUP);

            expect(riot.getAccountByRiotId).not.toHaveBeenCalled();
            expect(repository.save).not.toHaveBeenCalled();
            expect(profile.summonerLevel).toBe(500);
        });
    });

    describe('when Riot has to be asked', () => {
        it('refreshes a stale profile, and says so', async () => {
            repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS + 1));

            const profile = await service.findByRiotId(LOOKUP);

            expect(riot.getAccountByRiotId).toHaveBeenCalledWith(LOOKUP);
            expect(riot.getSummonerByPuuid).toHaveBeenCalledWith('p-1', EPlatformRegion.EUW);
            expect(profile.summonerLevel).toBe(501);
            expect(infoLog).toHaveBeenCalledWith('Refreshed Faker#KR1 on euw1');
        });

        it('stores what Riot returned, along with the Riot ID as it was searched', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);

            await service.findByRiotId(LOOKUP);

            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    puuid: 'p-1',
                    region: EPlatformRegion.EUW,
                    gameName: 'Faker',
                    tagLine: 'KR1',
                    profileIconId: 22,
                    summonerLevel: 501,
                }),
                LOOKUP,
            );
        });
    });

    describe('when Riot cannot refresh the profile', () => {
        it.each([
            ['a rejected key', new BadGatewayException()],
            ['a rate limit', new HttpException('', HttpStatus.TOO_MANY_REQUESTS)],
            ['an outage', new ServiceUnavailableException()],
        ])('serves the stored profile, however old, on %s', async (_, failure) => {
            repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS * 100));
            riot.getAccountByRiotId.mockRejectedValue(failure);

            const profile = await service.findByRiotId(LOOKUP);

            expect(profile.summonerLevel).toBe(500);
            expect(repository.save).not.toHaveBeenCalled();
            // Swallowing an error is only acceptable when it is logged.
            expect(warnLog).toHaveBeenCalledWith(
                expect.stringContaining('Serving the stored profile of Faker#KR1 on euw1'),
            );
        });

        it('fails when nothing is stored', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);
            riot.getAccountByRiotId.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(
                ServiceUnavailableException,
            );
        });

        it('does not serve a player Riot no longer knows', async () => {
            repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS + 1));
            riot.getAccountByRiotId.mockRejectedValue(new NotFoundException());

            await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('does not hide a failure that is not Riot’s', async () => {
            const databaseFailure = new Error('connection lost');
            repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS + 1));
            repository.save.mockRejectedValue(databaseFailure);

            await expect(service.findByRiotId(LOOKUP)).rejects.toBe(databaseFailure);
        });
    });

    it('treats a stored profile aged exactly at the TTL as stale', async () => {
        repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS));

        await service.findByRiotId(LOOKUP);

        expect(riot.getAccountByRiotId).toHaveBeenCalledWith(LOOKUP);
    });

    it('exposes updatedAt as an ISO string, not a Date', async () => {
        repository.findByRiotId.mockResolvedValue(rowAgedSeconds(0));

        const profile = await service.findByRiotId(LOOKUP);

        expect(typeof profile.updatedAt).toBe('string');
        expect(() => new Date(profile.updatedAt).toISOString()).not.toThrow();
    });

    describe('resolvePlayer — the single resolution ranks, masteries and matches share', () => {
        it('returns the stored identity without calling Riot when a row already exists', async () => {
            repository.findByRiotId.mockResolvedValue(rowAgedSeconds(TTL_SECONDS * 100));

            const resolved = await service.resolvePlayer(LOOKUP);

            expect(resolved).toEqual({ puuid: 'p-1', gameName: 'Faker', tagLine: 'KR1' });
            expect(riot.getAccountByRiotId).not.toHaveBeenCalled();
        });

        it('falls back to the full resolution when the player was never stored', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);

            const resolved = await service.resolvePlayer(LOOKUP);

            expect(resolved).toEqual({ puuid: 'p-1', gameName: 'Faker', tagLine: 'KR1' });
            expect(riot.getAccountByRiotId).toHaveBeenCalledWith(LOOKUP);
        });
    });

    /**
     * A profile page fires its four routes — profile, ranks, masteries, matches — at
     * once, and for a player never seen before every one of them ends up asking this
     * service to resolve the same Riot ID at essentially the same time. These tests
     * pin the in-flight dedup that turns that into one Riot round trip instead of four.
     */
    describe('concurrent resolution of the same Riot ID', () => {
        /** Lets a test control exactly when a mocked Riot call settles. */
        function deferred<T>() {
            let resolve!: (value: T) => void;
            let reject!: (reason: unknown) => void;
            const promise = new Promise<T>((res, rej) => {
                resolve = res;
                reject = rej;
            });
            return { promise, resolve, reject };
        }

        it('dedupes two concurrent requests for the same Riot ID into one Riot round trip', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);
            const account = deferred<{ puuid: string; gameName: string; tagLine: string }>();
            riot.getAccountByRiotId.mockReturnValue(account.promise);

            const first = service.findByRiotId(LOOKUP);
            const second = service.resolvePlayer(LOOKUP);

            // Both callers are now waiting on the same in-flight resolution; only once
            // it settles do they get an answer.
            account.resolve({ puuid: 'p-1', gameName: 'Faker', tagLine: 'KR1' });
            const [profile, resolved] = await Promise.all([first, second]);

            expect(riot.getAccountByRiotId).toHaveBeenCalledTimes(1);
            expect(riot.getSummonerByPuuid).toHaveBeenCalledTimes(1);
            expect(profile.puuid).toBe('p-1');
            expect(resolved.puuid).toBe('p-1');
        });

        it('does not memoise a failed resolution, so a later request retries Riot instead of repeating the same failure', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);
            riot.getAccountByRiotId.mockRejectedValueOnce(new NotFoundException());

            await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);

            riot.getAccountByRiotId.mockResolvedValueOnce({
                puuid: 'p-1',
                gameName: 'Faker',
                tagLine: 'KR1',
            });
            await service.findByRiotId(LOOKUP);

            expect(riot.getAccountByRiotId).toHaveBeenCalledTimes(2);
        });

        it('resolves two concurrent requests for the same Riot ID together even when the resolution fails', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);
            const account = deferred<never>();
            riot.getAccountByRiotId.mockReturnValue(account.promise);

            const first = service.findByRiotId(LOOKUP);
            const second = service.findByRiotId(LOOKUP);

            account.reject(new NotFoundException());

            await expect(first).rejects.toBeInstanceOf(NotFoundException);
            await expect(second).rejects.toBeInstanceOf(NotFoundException);
            expect(riot.getAccountByRiotId).toHaveBeenCalledTimes(1);
        });

        it('resolves two different Riot IDs independently, neither waiting on the other', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);
            const other = { region: EPlatformRegion.EUW, gameName: 'other', tagLine: 'euw' };
            riot.getAccountByRiotId.mockImplementation(({ gameName, tagLine }) =>
                Promise.resolve({
                    puuid: gameName === 'other' ? 'p-2' : 'p-1',
                    gameName,
                    tagLine,
                }),
            );

            const [a, b] = await Promise.all([
                service.findByRiotId(LOOKUP),
                service.findByRiotId(other),
            ]);

            expect(riot.getAccountByRiotId).toHaveBeenCalledTimes(2);
            expect(a.puuid).toBe('p-1');
            expect(b.puuid).toBe('p-2');
        });

        it('is case-insensitive: the same Riot ID typed differently still dedupes to one call', async () => {
            repository.findByRiotId.mockResolvedValue(undefined);
            const account = deferred<{ puuid: string; gameName: string; tagLine: string }>();
            riot.getAccountByRiotId.mockReturnValue(account.promise);

            const first = service.findByRiotId(LOOKUP);
            const second = service.findByRiotId({
                region: EPlatformRegion.EUW,
                gameName: 'FAKER',
                tagLine: 'KR1',
            });

            account.resolve({ puuid: 'p-1', gameName: 'Faker', tagLine: 'KR1' });
            await Promise.all([first, second]);

            expect(riot.getAccountByRiotId).toHaveBeenCalledTimes(1);
        });
    });
});
