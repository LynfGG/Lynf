import { Module } from '@nestjs/common';

import { RiotExternal } from './externals/riot.external';

/**
 * Riot access lives in its own module: profiles, match history and live games
 * will all reach for it, and none of them should own it.
 */
@Module({
    providers: [RiotExternal],
    exports: [RiotExternal],
})
export class RiotModule {}
