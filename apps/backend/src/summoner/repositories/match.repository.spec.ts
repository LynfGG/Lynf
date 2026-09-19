import { EPlatformRegion } from '@lynf/shared';
import { eq, like } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/schema';
import { matches, summoners } from '../../database/schema';
import { MatchRepository } from './match.repository';
import { SummonerResourceReadRepository } from './summoner-resource-read.repository';

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
 * fixture another database-backed suite left in the shared test database — and
 * deleting `matches` by it cascades to `match_participants` for free. */
const PREFIX = 'MATCHREPO_';

function matchId(suffix: string) {
    return `${PREFIX}${suffix}`;
}

const PUUID = 'match-repository-p-1';
const REGION = EPlatformRegion.EUW;

// `summoner_resource_reads` — which the match id list read date lives in — has a
// foreign key to `summoners`. Matches themselves carry no such constraint (see the
// schema's own comment on why), so this fixture only matters for the read-date tests.
const SUMMONER = {
    puuid: PUUID,
    region: REGION,
    gameName: 'Faker',
    tagLine: 'KR1',
    profileIconId: 10,
    summonerLevel: 500,
    updatedAt: new Date(),
};

function newMatch(id: string, overrides: Partial<{ endedAt: Date; queueId: number }> = {}) {
    return {
        matchId: id,
        platformId: 'EUW1',
        queueId: overrides.queueId ?? 420,
        durationSeconds: 1800,
        endedAt: overrides.endedAt ?? new Date('2026-09-01T10:00:00.000Z'),
        gameVersion: '14.18.1',
    };
}

function participant(id: string, puuid: string, overrides: Partial<Record<string, unknown>> = {}) {
    return {
        matchId: id,
        puuid,
        teamId: 100,
        championId: 103,
        teamPosition: 'MIDDLE',
        win: true,
        kills: 5,
        deaths: 2,
        assists: 7,
        creepScore: 180,
        goldEarned: 12_000,
        totalDamageDealtToChampions: 20_000,
        items: [1001, 0, 0, 0, 0, 0, 3340],
        riotIdGameName: 'Faker',
        riotIdTagline: 'KR1',
        ...overrides,
    };
}

describeWithDatabase('MatchRepository', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let repository: MatchRepository;

    beforeAll(async () => {
        pool = new Pool({ connectionString: DATABASE_URL });
        database = drizzle(pool, { schema });
        repository = new MatchRepository(database, new SummonerResourceReadRepository(database));
    });

    afterAll(async () => {
        await pool.end();
    });

    beforeEach(async () => {
        await database.delete(matches).where(like(matches.matchId, `${PREFIX}%`));
        await database.delete(summoners).where(eq(summoners.puuid, PUUID));
        await database.insert(summoners).values(SUMMONER);
    });

    describe('the match id list read date', () => {
        it('has no read date before the list was ever read', async () => {
            await expect(repository.findReadAt(PUUID, REGION)).resolves.toBeNull();
        });

        it('dates the read', async () => {
            const readAt = new Date('2026-09-18T10:00:00.000Z');

            await repository.markListRead(PUUID, REGION, readAt);

            await expect(repository.findReadAt(PUUID, REGION)).resolves.toEqual(readAt);
        });
    });

    describe('findById', () => {
        it('returns undefined for a match never ingested', async () => {
            await expect(repository.findById(matchId('never-ingested'))).resolves.toBeUndefined();
        });

        it('returns the stored match', async () => {
            const id = matchId('by-id');
            await repository.insertMatch(newMatch(id), [participant(id, PUUID)]);

            await expect(repository.findById(id)).resolves.toMatchObject({
                matchId: id,
                platformId: 'EUW1',
            });
        });
    });

    describe('findExistingMatchIds', () => {
        it('returns an empty set for an empty input, without querying', async () => {
            await expect(repository.findExistingMatchIds([])).resolves.toEqual(new Set());
        });

        it('returns only the ids that are actually stored', async () => {
            const stored = matchId('known-1');
            await repository.insertMatch(newMatch(stored), [participant(stored, PUUID)]);

            const unknown = matchId('unknown-1');

            await expect(repository.findExistingMatchIds([stored, unknown])).resolves.toEqual(
                new Set([stored]),
            );
        });
    });

    describe('insertMatch and findRecentByPuuid', () => {
        it('stores a match with its participant and serves it back', async () => {
            const id = matchId('solo-1');
            await repository.insertMatch(newMatch(id), [participant(id, PUUID)]);

            const recent = await repository.findRecentByPuuid(PUUID, 20);

            expect(recent).toHaveLength(1);
            expect(recent[0].match).toMatchObject({ matchId: id, queueId: 420 });
            expect(recent[0].player).toMatchObject({ puuid: PUUID, championId: 103, kills: 5 });
        });

        it('orders matches newest first', async () => {
            const older = matchId('older');
            const newer = matchId('newer');

            await repository.insertMatch(
                newMatch(older, { endedAt: new Date('2026-09-01T08:00:00.000Z') }),
                [participant(older, PUUID)],
            );
            await repository.insertMatch(
                newMatch(newer, { endedAt: new Date('2026-09-05T08:00:00.000Z') }),
                [participant(newer, PUUID)],
            );

            const recent = await repository.findRecentByPuuid(PUUID, 20);

            expect(recent.map((row) => row.match.matchId)).toEqual([newer, older]);
        });

        it('respects the limit', async () => {
            const first = matchId('limit-1');
            const second = matchId('limit-2');

            await repository.insertMatch(
                newMatch(first, { endedAt: new Date('2026-09-01T08:00:00.000Z') }),
                [participant(first, PUUID)],
            );
            await repository.insertMatch(
                newMatch(second, { endedAt: new Date('2026-09-02T08:00:00.000Z') }),
                [participant(second, PUUID)],
            );

            const recent = await repository.findRecentByPuuid(PUUID, 1);

            expect(recent).toHaveLength(1);
            expect(recent[0].match.matchId).toBe(second);
        });

        it('never re-stores a match already present, even if asked to', async () => {
            const id = matchId('idempotent');
            await repository.insertMatch(newMatch(id), [participant(id, PUUID)]);

            // A second ingestion attempt at the same match — two overlapping refreshes,
            // for instance — must not fail, and must not duplicate the participant row.
            await expect(
                repository.insertMatch(newMatch(id), [participant(id, PUUID)]),
            ).resolves.toBeUndefined();

            const recent = await repository.findRecentByPuuid(PUUID, 20);
            expect(recent).toHaveLength(1);
        });

        it('only ever returns matches the given player actually played', async () => {
            const id = matchId('someone-elses');
            await repository.insertMatch(newMatch(id), [participant(id, 'someone-else-puuid')]);

            await expect(repository.findRecentByPuuid(PUUID, 20)).resolves.toEqual([]);
        });
    });

    describe('findParticipantsByMatchIds', () => {
        it('returns an empty array for an empty input, without querying', async () => {
            await expect(repository.findParticipantsByMatchIds([])).resolves.toEqual([]);
        });

        it('returns every participant of the given matches, not just the tracked one', async () => {
            const id = matchId('duel-1');
            await repository.insertMatch(newMatch(id), [
                participant(id, PUUID, { teamId: 100, teamPosition: 'MIDDLE' }),
                participant(id, 'opponent-puuid', { teamId: 200, teamPosition: 'MIDDLE' }),
            ]);

            const participants = await repository.findParticipantsByMatchIds([id]);

            expect(participants.map((row) => row.puuid).sort()).toEqual(
                [PUUID, 'opponent-puuid'].sort(),
            );
        });
    });
});
