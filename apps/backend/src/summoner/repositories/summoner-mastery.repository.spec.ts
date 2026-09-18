import { EPlatformRegion } from '@lynf/shared';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/schema';
import { summoners } from '../../database/schema';
import { SummonerMasteryRepository } from './summoner-mastery.repository';
import { SummonerResourceReadRepository } from './summoner-resource-read.repository';

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

describeWithDatabase('SummonerMasteryRepository', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let repository: SummonerMasteryRepository;

    beforeAll(async () => {
        pool = new Pool({ connectionString: DATABASE_URL });
        database = drizzle(pool, { schema });
        repository = new SummonerMasteryRepository(
            database,
            new SummonerResourceReadRepository(database),
        );
    });

    afterAll(async () => {
        await pool.end();
    });

    // Own puuid so this suite's cleanup never touches a fixture another database-backed
    // suite left in the shared test database.
    const PUUID = 'summoner-mastery-p-1';

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

    it('returns nothing for a player whose masteries were never read', async () => {
        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toEqual([]);
    });

    it('has no read date before the masteries were ever read', async () => {
        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW)).resolves.toBeNull();
    });

    it('stores masteries and dates the read', async () => {
        const readAt = new Date('2026-09-18T10:00:00.000Z');
        const lastPlayTime = new Date('2026-09-01T08:00:00.000Z');

        await repository.replaceAll(
            PUUID,
            EPlatformRegion.EUW,
            [
                {
                    puuid: PUUID,
                    region: EPlatformRegion.EUW,
                    championId: 103,
                    championLevel: 7,
                    championPoints: 250_000,
                    lastPlayTime,
                },
            ],
            readAt,
        );

        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toMatchObject([
            { championId: 103, championLevel: 7, championPoints: 250_000, lastPlayTime },
        ]);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW)).resolves.toEqual(readAt);
    });

    it('drops a champion no longer among the top standings', async () => {
        const ahri = {
            puuid: PUUID,
            region: EPlatformRegion.EUW,
            championId: 103,
            championLevel: 7,
            championPoints: 250_000,
            lastPlayTime: new Date('2026-09-01T08:00:00.000Z'),
        };
        const leeSin = { ...ahri, championId: 64, championPoints: 100_000 };

        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [ahri, leeSin], new Date());
        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [ahri], new Date());

        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toMatchObject([
            { championId: 103 },
        ]);
    });

    it('dates the read even when the player has never played', async () => {
        const readAt = new Date('2026-09-18T11:00:00.000Z');

        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [], readAt);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW)).resolves.toEqual(readAt);
        await expect(repository.findByPuuid(PUUID, EPlatformRegion.EUW)).resolves.toEqual([]);
    });

    it('orders stored masteries by points, highest first', async () => {
        const low = {
            puuid: PUUID,
            region: EPlatformRegion.EUW,
            championId: 64,
            championLevel: 4,
            championPoints: 10_000,
            lastPlayTime: new Date('2026-09-01T08:00:00.000Z'),
        };
        const high = { ...low, championId: 103, championPoints: 250_000 };

        await repository.replaceAll(PUUID, EPlatformRegion.EUW, [low, high], new Date());

        const stored = await repository.findByPuuid(PUUID, EPlatformRegion.EUW);
        expect(stored.map((row) => row.championId)).toEqual([103, 64]);
    });
});
