import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RiotModule } from './riot/riot.module';
import { SummonerModule } from './summoner/summoner.module';

@Module({
    imports: [ConfigModule, DatabaseModule, RiotModule, SummonerModule],
})
export class AppModule {}
