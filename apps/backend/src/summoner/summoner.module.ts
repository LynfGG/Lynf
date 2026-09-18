import { Module } from '@nestjs/common';

import { RiotModule } from '../riot/riot.module';
import { SummonerController } from './controllers/summoner.controller';
import { SummonerRankRepository } from './repositories/summoner-rank.repository';
import { SummonerRepository } from './repositories/summoner.repository';
import { SummonerRankService } from './services/summoner-rank.service';
import { SummonerService } from './services/summoner.service';

@Module({
    imports: [RiotModule],
    controllers: [SummonerController],
    providers: [SummonerService, SummonerRepository, SummonerRankService, SummonerRankRepository],
})
export class SummonerModule {}
