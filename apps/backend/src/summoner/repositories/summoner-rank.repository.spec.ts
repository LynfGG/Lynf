import { EPlatformRegion, ERankedQueue } from '@lynf/shared';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/schema';
import { summoners } from '../../database/schema';
import { SummonerRankRepository } from './summoner-rank.repository';

/**
 * Repositories are tested against a real database — stubbing one only proves the
 * stub. The suite is skipped when no test database is configured, so a machine
 * without Postgres still runs the rest of the suite.
 */
const DATABASE_URL = process.env.DATABASE_TEST_URL;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

// Every test starts by emptying the tables. Anything that is not visibly a test database
// is refused, so a copy-paste mistake cannot wipe a development one.
if (DATABASE_URL && !new URL(DATABASE_URL).pathname.endsWith('_test')) {
    throw new Error('DATABASE_TEST_URL must name a database ending in _test.');
}

describeWithDatabase('SummonerRankRepository', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let repository: SummonerRankRepository;

    beforeAll(async () => {
        pool = new Pool({ connectionString: DATABASE_URL });
        database = drizzle(pool, { schema });
        repository = new SummonerRankRepository(database);
    });

    afterAll(async () => {
        await pool.end();
    });

    // Own puuid so this suite's cleanup never touches a fixture another database-backed
    // suite left in the shared test database.
    const PUUID = 'summoner-rank-p-1';

    const SUMMONER = {
        puuid: PUUID,
        region: EPlatformRegion.EUW,
        gameName: 'Faker',
        tagLine: 'KR1',
        profileIconId: 10,
        summonerLevel: 500,
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        await database.delete(summoners).where(eq(summoners.puuid, PUUID));
        await database.insert(summoners).values(SUMMONER);
    });

    it('returns nothing for a player whose ranks were never read', async () => {
        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toEqual([]);
    });

    it('has no read date before the standings were ever read', async () => {
        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW)).resolves.toBeNull();
    });

    it('stores standings and dates the read on the summoner', async () => {
        const readAt = new Date('2026-09-18T10:00:00.000Z');

        await repository.replaceAll(
            PUUID,
            EPlatformRegion.EUW,
            [
                {
                    puuid: PUUID,
                    region: EPlatformRegion.EUW,
                    queue: ERankedQueue.SOLO,
                    tier: 'EMERALD',
                    division: 'II',
                    leaguePoints: 47,
                    wins: 68,
                    losses: 54,
                },
            ],
            readAt,
        );

        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toMatchObject([
            { queue: ERankedQueue.SOLO, tier: 'EMERALD', division: 'II', leaguePoints: 47 },
        ]);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW)).resolves.toEqual(readAt);
    });

    it('drops a queue the player no longer appears in', async () => {
        const solo = {
            puuid: PUUID,
            region: EPlatformRegion.EUW,
            queue: ERankedQueue.SOLO,
            tier: 'EMERALD',
            division: 'II',
            leaguePoints: 47,
            wins: 68,
            losses: 54,
        };
        const flex = { ...solo, queue: ERankedQueue.FLEX, tier: 'PLATINUM', division: 'IV' };

        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [solo, flex], new Date());
        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [solo], new Date());

        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toHaveLength(1);
    });

    it('dates the read even when the player is ranked nowhere', async () => {
        const readAt = new Date('2026-09-18T11:00:00.000Z');

        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [], readAt);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW)).resolves.toEqual(readAt);
        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toEqual([]);
    });
});
