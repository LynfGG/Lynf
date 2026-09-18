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
        ranksUpdatedAt: null,
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
});
