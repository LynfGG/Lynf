import { EPlatformRegion } from '@lynf/shared';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/schema';
import { summoners } from '../../database/schema';
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

describeWithDatabase('SummonerResourceReadRepository', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let repository: SummonerResourceReadRepository;

    beforeAll(async () => {
        pool = new Pool({ connectionString: DATABASE_URL });
        database = drizzle(pool, { schema });
        repository = new SummonerResourceReadRepository(database);
    });

    afterAll(async () => {
        await pool.end();
    });

    // Own puuid so this suite's cleanup never touches a fixture another database-backed
    // suite left in the shared test database.
    const PUUID = 'resource-read-p-1';

    beforeEach(async () => {
        await database.delete(summoners).where(eq(summoners.puuid, PUUID));
        await database.insert(summoners).values({
            puuid: PUUID,
            region: EPlatformRegion.EUW,
            gameName: 'Faker',
            tagLine: 'KR1',
            profileIconId: 10,
            summonerLevel: 500,
            updatedAt: new Date(),
        });
    });

    it('has no read date before a resource was ever read', async () => {
        await expect(
            repository.findReadAt(PUUID, EPlatformRegion.EUW, 'ranks'),
        ).resolves.toBeNull();
    });

    it('records and returns the read date of a resource', async () => {
        const readAt = new Date('2026-09-18T10:00:00.000Z');

        await repository.write(PUUID, EPlatformRegion.EUW, 'ranks', readAt);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW, 'ranks')).resolves.toEqual(
            readAt,
        );
    });

    it('replaces the previous read date of the same resource', async () => {
        await repository.write(
            PUUID,
            EPlatformRegion.EUW,
            'ranks',
            new Date('2026-09-01T00:00:00.000Z'),
        );

        const latest = new Date('2026-09-18T10:00:00.000Z');
        await repository.write(PUUID, EPlatformRegion.EUW, 'ranks', latest);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW, 'ranks')).resolves.toEqual(
            latest,
        );
    });

    it('keeps the read dates of different resources apart', async () => {
        const ranksReadAt = new Date('2026-09-10T00:00:00.000Z');
        const masteriesReadAt = new Date('2026-09-12T00:00:00.000Z');

        await repository.write(PUUID, EPlatformRegion.EUW, 'ranks', ranksReadAt);
        await repository.write(PUUID, EPlatformRegion.EUW, 'masteries', masteriesReadAt);

        await expect(repository.findReadAt(PUUID, EPlatformRegion.EUW, 'ranks')).resolves.toEqual(
            ranksReadAt,
        );
        await expect(
            repository.findReadAt(PUUID, EPlatformRegion.EUW, 'masteries'),
        ).resolves.toEqual(masteriesReadAt);
    });
});
