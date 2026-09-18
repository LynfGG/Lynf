import { EPlatformRegion } from '@lynf/shared';
import { BadGatewayException, Logger, NotFoundException } from '@nestjs/common';

import type { Environment } from '../../config/environment';
import type { SummonerMasteryRow, SummonerRow } from '../../database/schema';
import type { RiotExternal } from '../../riot/externals/riot.external';
import type { SummonerMasteryRepository } from '../repositories/summoner-mastery.repository';
import type { SummonerRepository } from '../repositories/summoner.repository';
import type { SummonerService } from './summoner.service';
import { SummonerMasteryService } from './summoner-mastery.service';

const TTL_SECONDS = 3600;
const ENVIRONMENT = { SUMMONER_MASTERIES_TTL_SECONDS: TTL_SECONDS } as Environment;
const LOOKUP = { region: EPlatformRegion.EUW, gameName: 'faker', tagLine: 'kr1' };

const PROFILE = {
    puuid: 'p-1',
    gameName: 'Faker',
    tagLine: 'KR1',
    region: EPlatformRegion.EUW,
    profileIconId: 10,
    summonerLevel: 500,
    updatedAt: new Date().toISOString(),
};

/** `null` means the masteries were never read — which is not the same as "never played". */
function readSecondsAgo(seconds: number) {
    return new Date(Date.now() - seconds * 1000);
}

const LAST_PLAYED = new Date('2026-09-01T08:00:00.000Z');

const STORED: SummonerMasteryRow = {
    puuid: 'p-1',
    region: EPlatformRegion.EUW,
    championId: 103,
    championLevel: 7,
    championPoints: 250_000,
    lastPlayTime: LAST_PLAYED,
};

/** A player already seen before: a `summoners` row exists, whatever its age. */
const STORED_SUMMONER: SummonerRow = {
    puuid: 'p-1',
    region: EPlatformRegion.EUW,
    gameName: 'Faker',
    tagLine: 'KR1',
    profileIconId: 10,
    summonerLevel: 500,
    updatedAt: readSecondsAgo(60 * 60 * 24 * 30),
};

describe('SummonerMasteryService', () => {
    let summoners: jest.Mocked<Pick<SummonerService, 'findByRiotId'>>;
    let summonerRepository: jest.Mocked<Pick<SummonerRepository, 'findByRiotId'>>;
    let repository: jest.Mocked<
        Pick<SummonerMasteryRepository, 'findByPuuid' | 'replaceAll' | 'findReadAt'>
    >;
    let riot: jest.Mocked<Pick<RiotExternal, 'getTopChampionMasteriesByPuuid'>>;
    let service: SummonerMasteryService;
    let warnLog: jest.SpyInstance;

    beforeEach(() => {
        summoners = { findByRiotId: jest.fn() };
        summonerRepository = { findByRiotId: jest.fn() };
        repository = { findByPuuid: jest.fn(), replaceAll: jest.fn(), findReadAt: jest.fn() };
        riot = { getTopChampionMasteriesByPuuid: jest.fn() };
        service = new SummonerMasteryService(
            summoners as unknown as SummonerService,
            summonerRepository as unknown as SummonerRepository,
            repository as unknown as SummonerMasteryRepository,
            riot as unknown as RiotExternal,
            ENVIRONMENT,
        );

        // The default fixture is a player never stored before: it exercises the same
        // full-resolution path the tests relied on before storage was checked first.
        summonerRepository.findByRiotId.mockResolvedValue(undefined);
        summoners.findByRiotId.mockResolvedValue(PROFILE);
        repository.findReadAt.mockResolvedValue(null);
        repository.findByPuuid.mockResolvedValue([]);
        repository.replaceAll.mockImplementation(
            async (_puuid, _region, masteries) => masteries as SummonerMasteryRow[],
        );
        riot.getTopChampionMasteriesByPuuid.mockResolvedValue([]);

        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    it('skips the full profile resolution when the player is already stored', async () => {
        summonerRepository.findByRiotId.mockResolvedValue(STORED_SUMMONER);
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS - 1));
        repository.findByPuuid.mockResolvedValue([STORED]);

        await service.findByRiotId(LOOKUP);

        expect(summoners.findByRiotId).not.toHaveBeenCalled();
        expect(repository.findReadAt).toHaveBeenCalledWith('p-1', EPlatformRegion.EUW);
    });

    it('resolves the full profile and still fetches and saves masteries when the player was never stored', async () => {
        summonerRepository.findByRiotId.mockResolvedValue(undefined);
        riot.getTopChampionMasteriesByPuuid.mockResolvedValue([
            {
                championId: 103,
                championLevel: 7,
                championPoints: 250_000,
                lastPlayTime: LAST_PLAYED.getTime(),
            },
        ]);

        await service.findByRiotId(LOOKUP);

        expect(summoners.findByRiotId).toHaveBeenCalledWith(LOOKUP);
        expect(riot.getTopChampionMasteriesByPuuid).toHaveBeenCalledWith(
            'p-1',
            EPlatformRegion.EUW,
        );
        expect(repository.replaceAll).toHaveBeenCalledWith(
            'p-1',
            EPlatformRegion.EUW,
            [expect.objectContaining({ championId: 103, lastPlayTime: LAST_PLAYED })],
            expect.any(Date),
        );
    });

    it('serves what is stored while it is fresh, without calling Riot', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS - 1));
        repository.findByPuuid.mockResolvedValue([STORED]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([
            {
                championId: 103,
                championLevel: 7,
                championPoints: 250_000,
                lastPlayTime: LAST_PLAYED.toISOString(),
            },
        ]);
        expect(riot.getTopChampionMasteriesByPuuid).not.toHaveBeenCalled();
    });

    it('asks Riot again once the stored masteries are stale', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getTopChampionMasteriesByPuuid.mockResolvedValue([
            {
                championId: 64,
                championLevel: 5,
                championPoints: 80_000,
                lastPlayTime: LAST_PLAYED.getTime(),
            },
        ]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toMatchObject([{ championId: 64 }]);
        expect(riot.getTopChampionMasteriesByPuuid).toHaveBeenCalledWith(
            'p-1',
            EPlatformRegion.EUW,
        );
    });

    it('asks Riot when the masteries were never read, even with no rows stored', async () => {
        repository.findReadAt.mockResolvedValue(null);

        await service.findByRiotId(LOOKUP);

        expect(riot.getTopChampionMasteriesByPuuid).toHaveBeenCalled();
    });

    it('records a player who has never played so Riot is not asked again immediately', async () => {
        repository.findReadAt.mockResolvedValue(null);
        riot.getTopChampionMasteriesByPuuid.mockResolvedValue([]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([]);
        expect(repository.replaceAll).toHaveBeenCalledWith(
            'p-1',
            EPlatformRegion.EUW,
            [],
            expect.any(Date),
        );
    });

    it('serves stale masteries when Riot refuses, and says so', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getTopChampionMasteriesByPuuid.mockRejectedValue(new BadGatewayException());

        await expect(service.findByRiotId(LOOKUP)).resolves.toMatchObject([{ championId: 103 }]);
        expect(warnLog).toHaveBeenCalled();
    });

    it('lets the failure through when nothing was ever read', async () => {
        repository.findReadAt.mockResolvedValue(null);
        riot.getTopChampionMasteriesByPuuid.mockRejectedValue(new BadGatewayException());

        await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(BadGatewayException);
    });

    it("never hides a failure that is not Riot's", async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getTopChampionMasteriesByPuuid.mockRejectedValue(new Error('the pool is gone'));

        await expect(service.findByRiotId(LOOKUP)).rejects.toThrow('the pool is gone');
    });

    it('lets a missing player through as a 404', async () => {
        // Never stored, so the full resolution runs, and Riot has never heard of them.
        summonerRepository.findByRiotId.mockResolvedValue(undefined);
        summoners.findByRiotId.mockRejectedValue(new NotFoundException());

        await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a 404 from the refresh call through instead of serving stale masteries', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getTopChampionMasteriesByPuuid.mockRejectedValue(new NotFoundException());

        await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats masteries read exactly at the TTL as stale', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getTopChampionMasteriesByPuuid.mockResolvedValue([]);

        await service.findByRiotId(LOOKUP);

        expect(riot.getTopChampionMasteriesByPuuid).toHaveBeenCalledWith(
            'p-1',
            EPlatformRegion.EUW,
        );
    });
});
