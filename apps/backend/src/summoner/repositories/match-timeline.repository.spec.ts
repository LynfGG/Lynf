import { like } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/schema';
import { matches } from '../../database/schema';
import type { NewMatchTimelineRow } from '../../database/schema/match-timeline';
import { MatchTimelineRepository } from './match-timeline.repository';

/**
 * Repositories are tested against a real database — stubbing one only proves the stub.
 * The suite is skipped when no test database is configured, so a machine without
 * Postgres still runs the rest of the suite.
 */
const DATABASE_URL = process.env.DATABASE_TEST_URL;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

// Every test starts by emptying its own rows. Anything that is not visibly a test
// database is refused, so a copy-paste mistake cannot wipe a development one.
if (DATABASE_URL && !new URL(DATABASE_URL).pathname.endsWith('_test')) {
    throw new Error('DATABASE_TEST_URL must name a database ending in _test.');
}

/** Every match id this suite creates starts with this, so cleanup never touches a
 * fixture another database-backed suite left in the shared test database. */
const PREFIX = 'TIMELINEREPO_';

function matchId(suffix: string) {
    return `${PREFIX}${suffix}`;
}

function newMatch(id: string) {
    return {
        matchId: id,
        platformId: 'EUW1',
        queueId: 420,
        durationSeconds: 1800,
        endedAt: new Date('2026-09-01T10:00:00.000Z'),
        gameVersion: '14.18.1',
    };
}

function timeline(id: string, overrides: Partial<NewMatchTimelineRow> = {}): NewMatchTimelineRow {
    return {
        matchId: id,
        frames: [{ puuid: 'p-1', minute: 0, totalGold: 500, creepScore: 0, xp: 0, level: 1 }],
        skillLevelUps: [{ puuid: 'p-1', timestampMs: 60_000, skillSlot: 1 }],
        itemEvents: [{ puuid: 'p-1', timestampMs: 90_000, itemId: 1055, action: 'PURCHASED' }],
        kills: [
            {
                timestampMs: 194_547,
                killerPuuid: 'p-1',
                victimPuuid: 'p-2',
                assistingPuuids: [],
            },
        ],
        ...overrides,
    };
}

describeWithDatabase('MatchTimelineRepository', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let repository: MatchTimelineRepository;

    beforeAll(async () => {
        pool = new Pool({ connectionString: DATABASE_URL });
        database = drizzle(pool, { schema });
        repository = new MatchTimelineRepository(database);
    });

    afterAll(async () => {
        await pool.end();
    });

    beforeEach(async () => {
        // Deleting the match cascades to its timeline, so cleanup only needs one table.
        await database.delete(matches).where(like(matches.matchId, `${PREFIX}%`));
    });

    describe('findByMatchId', () => {
        it('returns undefined for a match with no timeline extracted yet', async () => {
            const id = matchId('no-timeline');
            await database.insert(matches).values(newMatch(id));

            await expect(repository.findByMatchId(id)).resolves.toBeUndefined();
        });

        it('returns the stored timeline once extracted', async () => {
            const id = matchId('with-timeline');
            await database.insert(matches).values(newMatch(id));
            await repository.insert(timeline(id));

            const stored = await repository.findByMatchId(id);

            expect(stored).toMatchObject({
                matchId: id,
                frames: [{ puuid: 'p-1', minute: 0, totalGold: 500 }],
                skillLevelUps: [{ puuid: 'p-1', skillSlot: 1 }],
                itemEvents: [{ puuid: 'p-1', itemId: 1055, action: 'PURCHASED' }],
                kills: [{ killerPuuid: 'p-1', victimPuuid: 'p-2' }],
            });
        });
    });

    describe('insert', () => {
        it('never re-stores a timeline already present, even if asked to', async () => {
            const id = matchId('idempotent');
            await database.insert(matches).values(newMatch(id));
            await repository.insert(timeline(id));

            // A second extraction of the same match's timeline — two overlapping
            // requests racing, for instance — must not fail and must not duplicate it.
            await expect(repository.insert(timeline(id, { frames: [] }))).resolves.toBeUndefined();

            const stored = await repository.findByMatchId(id);
            expect(stored?.frames).toHaveLength(1);
        });
    });
});
