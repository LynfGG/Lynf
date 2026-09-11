import { Module } from '@nestjs/common';

import { RiotModule } from '../riot/riot.module';
import { SummonerController } from './controllers/summoner.controller';
import { SummonerRepository } from './repositories/summoner.repository';
import { SummonerService } from './services/summoner.service';

@Module({
    imports: [RiotModule],
    controllers: [SummonerController],
    providers: [SummonerService, SummonerRepository],
})
export class SummonerModule {}
