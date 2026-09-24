import { Module } from '@nestjs/common';

import { RiotModule } from '../riot/riot.module';
import { SummonerController } from './controllers/summoner.controller';
import { SummonerRankController } from './controllers/summoner-rank.controller';
import { SummonerRepository } from './repositories/summoner.repository';
import { SummonerRankService } from './services/summoner-rank.service';
import { SummonerService } from './services/summoner.service';

@Module({
    imports: [RiotModule],
    controllers: [SummonerController, SummonerRankController],
    providers: [SummonerService, SummonerRankService, SummonerRepository],
})
export class SummonerModule {}
