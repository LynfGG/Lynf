import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { ENVIRONMENT } from '../config/config.module';
import type { Environment } from '../config/environment';
import * as schema from './schema/index';

/** Injection token for the Drizzle client. Repositories depend on this and nothing else. */
export const DATABASE = Symbol('DATABASE');

/** Injection token for the connection pool behind it. Only this module touches it. */
const DATABASE_POOL = Symbol('DATABASE_POOL');

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
    providers: [
        {
            provide: DATABASE_POOL,
            inject: [ENVIRONMENT],
            useFactory: (environment: Environment) => {
                const logger = new Logger(DatabaseModule.name);
                const pool = new Pool({ connectionString: environment.DATABASE_URL });

                // An idle connection that drops — Postgres restarted, network lost — emits an
                // error on the pool. Left without a listener, that event crashes the process;
                // the pool replaces the connection on the next query.
                pool.on('error', (error) => {
                    logger.error(`Idle connection lost: ${error.message}`);
                });

                return pool;
            },
        },
        {
            provide: DATABASE,
            inject: [DATABASE_POOL],
            useFactory: (pool: Pool) => drizzle(pool, { schema }),
        },
    ],
    exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
    constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

    async onApplicationShutdown() {
        await this.pool.end();
    }
}
