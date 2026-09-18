import { EPlatformRegion } from '@lynf/shared';
import { and, eq, like } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/schema';
import { summonerRiotIds, summoners } from '../../database/schema';
import { SummonerRepository } from './summoner.repository';

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

describeWithDatabase('SummonerRepository', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let repository: SummonerRepository;

    beforeAll(async () => {
        pool = new Pool({ connectionString: DATABASE_URL });
        database = drizzle(pool, { schema });
        repository = new SummonerRepository(database);
    });

    afterAll(async () => {
        await pool.end();
    });

    // Own puuid prefix so this suite's cleanup never touches fixtures another
    // database-backed suite left in the shared test database.
    const PUUID_PREFIX = 'summoner-repo-';
    const PUUID_1 = `${PUUID_PREFIX}p-1`;
    const PUUID_2 = `${PUUID_PREFIX}p-2`;

    beforeEach(async () => {
        // Their Riot IDs go with them.
        await database.delete(summoners).where(like(summoners.puuid, `${PUUID_PREFIX}%`));
    });

    const profile = {
        puuid: PUUID_1,
        region: EPlatformRegion.EUW,
        gameName: 'Faker',
        tagLine: 'KR1',
        profileIconId: 10,
        summonerLevel: 500,
        updatedAt: new Date(),
    };

    const FAKER_ON_EUW = { region: EPlatformRegion.EUW, gameName: 'Faker', tagLine: 'KR1' };

    it('returns nothing when the player is unknown', async () => {
        await expect(
            repository.findByRiotId({
                region: EPlatformRegion.EUW,
                gameName: 'Nobody',
                tagLine: 'ZZZ',
            }),
        ).resolves.toBeUndefined();
    });

    it('stores a profile and finds it under the Riot ID it was searched with', async () => {
        await repository.save(profile, FAKER_ON_EUW);

        await expect(repository.findByRiotId(FAKER_ON_EUW)).resolves.toMatchObject({
            puuid: PUUID_1,
            summonerLevel: 500,
        });
    });

    it('matches a Riot ID regardless of case', async () => {
        await repository.save(profile, FAKER_ON_EUW);

        await expect(
            repository.findByRiotId({
                region: EPlatformRegion.EUW,
                gameName: 'FAKER',
                tagLine: 'kr1',
            }),
        ).resolves.toMatchObject({ puuid: PUUID_1 });
    });

    it('finds a profile Riot names differently from the search, under both names', async () => {
        const searched = { region: EPlatformRegion.EUW, gameName: 'Caps', tagLine: 'EUW' };
        await repository.save({ ...profile, gameName: 'Cäps', tagLine: 'EUW' }, searched);

        await expect(repository.findByRiotId(searched)).resolves.toMatchObject({
            gameName: 'Cäps',
        });
        await expect(
            repository.findByRiotId({ ...searched, gameName: 'Cäps' }),
        ).resolves.toMatchObject({ gameName: 'Cäps' });
    });

    it('does not confuse the same Riot ID on another platform', async () => {
        await repository.save(profile, FAKER_ON_EUW);

        await expect(
            repository.findByRiotId({ ...FAKER_ON_EUW, region: EPlatformRegion.NA }),
        ).resolves.toBeUndefined();
    });

    it('updates in place rather than duplicating on a second save', async () => {
        await repository.save(profile, FAKER_ON_EUW);
        await repository.save({ ...profile, summonerLevel: 501 }, FAKER_ON_EUW);

        // Scoped to this suite's own puuids: the shared table may also hold another
        // database-backed suite's fixture rows when both run in parallel.
        const rows = await database
            .select()
            .from(summoners)
            .where(like(summoners.puuid, `${PUUID_PREFIX}%`));
        const riotIds = await database.select().from(summonerRiotIds);

        expect(rows).toHaveLength(1);
        expect(rows[0].summonerLevel).toBe(501);
        expect(riotIds).toHaveLength(1);
    });

    it('keeps one profile per platform for the same account', async () => {
        const fakerOnNa = { ...FAKER_ON_EUW, region: EPlatformRegion.NA };
        await repository.save(profile, FAKER_ON_EUW);
        await repository.save(
            { ...profile, region: EPlatformRegion.NA, summonerLevel: 30 },
            fakerOnNa,
        );

        await expect(repository.findByRiotId(FAKER_ON_EUW)).resolves.toMatchObject({
            summonerLevel: 500,
        });
        await expect(repository.findByRiotId(fakerOnNa)).resolves.toMatchObject({
            summonerLevel: 30,
        });
    });

    it('follows a Riot ID to the account that holds it now', async () => {
        await repository.save(profile, FAKER_ON_EUW);
        await repository.save({ ...profile, puuid: PUUID_2 }, FAKER_ON_EUW);

        await expect(repository.findByRiotId(FAKER_ON_EUW)).resolves.toMatchObject({
            puuid: PUUID_2,
        });
    });

    it('refreshes the timestamp when a later save does not provide one', async () => {
        const staleDate = new Date('2020-01-01T00:00:00Z');
        await repository.save({ ...profile, updatedAt: staleDate }, FAKER_ON_EUW);

        await repository.save(
            {
                puuid: profile.puuid,
                region: profile.region,
                gameName: profile.gameName,
                tagLine: profile.tagLine,
                profileIconId: profile.profileIconId,
                summonerLevel: profile.summonerLevel,
            },
            FAKER_ON_EUW,
        );

        const [row] = await database
            .select()
            .from(summoners)
            .where(and(eq(summoners.puuid, profile.puuid), eq(summoners.region, profile.region)));

        // Without this, a refreshed profile would keep its stale date and be served as
        // fresh-looking data that is actually old.
        expect(row.updatedAt.getTime()).toBeGreaterThan(staleDate.getTime());
    });
});
