import { EPlatformRegion, ERankedQueue } from '@lynf/shared';
import { BadGatewayException, Logger, NotFoundException } from '@nestjs/common';

import type { Environment } from '../../config/environment';
import type { SummonerRankRow } from '../../database/schema';
import type { RiotExternal } from '../../riot/externals/riot.external';
import type { SummonerRankRepository } from '../repositories/summoner-rank.repository';
import type { SummonerService } from './summoner.service';
import { SummonerRankService } from './summoner-rank.service';

const TTL_SECONDS = 900;
const ENVIRONMENT = { SUMMONER_RANKS_TTL_SECONDS: TTL_SECONDS } as Environment;
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

/** `null` means the standings were never read — which is not the same as "not ranked". */
function readSecondsAgo(seconds: number) {
    return new Date(Date.now() - seconds * 1000);
}

const STORED: SummonerRankRow = {
    puuid: 'p-1',
    region: EPlatformRegion.EUW,
    queue: ERankedQueue.SOLO,
    tier: 'EMERALD',
    division: 'II',
    leaguePoints: 47,
    wins: 68,
    losses: 54,
};

describe('SummonerRankService', () => {
    let summoners: jest.Mocked<Pick<SummonerService, 'findByRiotId'>>;
    let repository: jest.Mocked<
        Pick<SummonerRankRepository, 'findByPuuid' | 'replaceAll' | 'findReadAt'>
    >;
    let riot: jest.Mocked<Pick<RiotExternal, 'getLeagueEntriesByPuuid'>>;
    let service: SummonerRankService;
    let warnLog: jest.SpyInstance;

    beforeEach(() => {
        summoners = { findByRiotId: jest.fn() };
        repository = { findByPuuid: jest.fn(), replaceAll: jest.fn(), findReadAt: jest.fn() };
        riot = { getLeagueEntriesByPuuid: jest.fn() };
        service = new SummonerRankService(
            summoners as unknown as SummonerService,
            repository as unknown as SummonerRankRepository,
            riot as unknown as RiotExternal,
            ENVIRONMENT,
        );

        summoners.findByRiotId.mockResolvedValue(PROFILE);
        repository.findReadAt.mockResolvedValue(null);
        repository.findByPuuid.mockResolvedValue([]);
        repository.replaceAll.mockImplementation(
            async (_puuid, _region, ranks) => ranks as SummonerRankRow[],
        );
        riot.getLeagueEntriesByPuuid.mockResolvedValue([]);

        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    it('serves what is stored while it is fresh, without calling Riot', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS - 1));
        repository.findByPuuid.mockResolvedValue([STORED]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([
            {
                queue: ERankedQueue.SOLO,
                tier: 'EMERALD',
                division: 'II',
                leaguePoints: 47,
                wins: 68,
                losses: 54,
            },
        ]);
        expect(riot.getLeagueEntriesByPuuid).not.toHaveBeenCalled();
    });

    it('asks Riot again once the stored standings are stale', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getLeagueEntriesByPuuid.mockResolvedValue([
            {
                queueType: ERankedQueue.SOLO,
                tier: 'DIAMOND',
                rank: 'IV',
                leaguePoints: 3,
                wins: 70,
                losses: 55,
            },
        ]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toMatchObject([{ tier: 'DIAMOND' }]);
        expect(riot.getLeagueEntriesByPuuid).toHaveBeenCalledWith('p-1', EPlatformRegion.EUW);
    });

    it('asks Riot when the standings were never read, even with no rows stored', async () => {
        repository.findReadAt.mockResolvedValue(null);

        await service.findByRiotId(LOOKUP);

        expect(riot.getLeagueEntriesByPuuid).toHaveBeenCalled();
    });

    it('drops the queues Lynf does not show', async () => {
        repository.findReadAt.mockResolvedValue(null);
        riot.getLeagueEntriesByPuuid.mockResolvedValue([
            {
                queueType: 'CHERRY',
                tier: 'GOLD',
                rank: 'I',
                leaguePoints: 0,
                wins: 1,
                losses: 1,
            },
            {
                queueType: ERankedQueue.FLEX,
                tier: 'PLATINUM',
                rank: 'IV',
                leaguePoints: 12,
                wins: 9,
                losses: 7,
            },
        ]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([
            {
                queue: ERankedQueue.FLEX,
                tier: 'PLATINUM',
                division: 'IV',
                leaguePoints: 12,
                wins: 9,
                losses: 7,
            },
        ]);
    });

    it('orders standings by queue regardless of storage or Riot order', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS - 1));
        repository.findByPuuid.mockResolvedValue([
            { ...STORED, queue: ERankedQueue.FLEX },
            { ...STORED, queue: ERankedQueue.SOLO },
        ]);

        const ranks = await service.findByRiotId(LOOKUP);

        expect(ranks.map((rank) => rank.queue)).toEqual([ERankedQueue.SOLO, ERankedQueue.FLEX]);
    });

    it('orders a freshly refreshed standing the same way, whatever order Riot answered in', async () => {
        repository.findReadAt.mockResolvedValue(null);
        riot.getLeagueEntriesByPuuid.mockResolvedValue([
            {
                queueType: ERankedQueue.FLEX,
                tier: 'PLATINUM',
                rank: 'IV',
                leaguePoints: 12,
                wins: 9,
                losses: 7,
            },
            {
                queueType: ERankedQueue.SOLO,
                tier: 'EMERALD',
                rank: 'II',
                leaguePoints: 47,
                wins: 68,
                losses: 54,
            },
        ]);

        const ranks = await service.findByRiotId(LOOKUP);

        expect(ranks.map((rank) => rank.queue)).toEqual([ERankedQueue.SOLO, ERankedQueue.FLEX]);
    });

    it('records an unranked player so Riot is not asked again immediately', async () => {
        repository.findReadAt.mockResolvedValue(null);
        riot.getLeagueEntriesByPuuid.mockResolvedValue([]);

        await expect(service.findByRiotId(LOOKUP)).resolves.toEqual([]);
        expect(repository.replaceAll).toHaveBeenCalledWith(
            'p-1',
            EPlatformRegion.EUW,
            [],
            expect.any(Date),
        );
    });

    it('serves stale standings when Riot refuses, and says so', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getLeagueEntriesByPuuid.mockRejectedValue(new BadGatewayException());

        await expect(service.findByRiotId(LOOKUP)).resolves.toMatchObject([{ tier: 'EMERALD' }]);
        expect(warnLog).toHaveBeenCalled();
    });

    it('lets the failure through when nothing was ever read', async () => {
        repository.findReadAt.mockResolvedValue(null);
        riot.getLeagueEntriesByPuuid.mockRejectedValue(new BadGatewayException());

        await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(BadGatewayException);
    });

    it("never hides a failure that is not Riot's", async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getLeagueEntriesByPuuid.mockRejectedValue(new Error('the pool is gone'));

        await expect(service.findByRiotId(LOOKUP)).rejects.toThrow('the pool is gone');
    });

    it('lets a missing player through as a 404', async () => {
        summoners.findByRiotId.mockRejectedValue(new NotFoundException());

        await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a 404 from the refresh call through instead of serving stale standings', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS + 1));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getLeagueEntriesByPuuid.mockRejectedValue(new NotFoundException());

        await expect(service.findByRiotId(LOOKUP)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats standings read exactly at the TTL as stale', async () => {
        repository.findReadAt.mockResolvedValue(readSecondsAgo(TTL_SECONDS));
        repository.findByPuuid.mockResolvedValue([STORED]);
        riot.getLeagueEntriesByPuuid.mockResolvedValue([]);

        await service.findByRiotId(LOOKUP);

        expect(riot.getLeagueEntriesByPuuid).toHaveBeenCalledWith('p-1', EPlatformRegion.EUW);
    });
});
