import { Module } from '@nestjs/common';

import { RiotModule } from '../riot/riot.module';
import { SummonerController } from './controllers/summoner.controller';
import { MatchRepository } from './repositories/match.repository';
import { SummonerMasteryRepository } from './repositories/summoner-mastery.repository';
import { SummonerRankRepository } from './repositories/summoner-rank.repository';
import { SummonerRepository } from './repositories/summoner.repository';
import { SummonerResourceReadRepository } from './repositories/summoner-resource-read.repository';
import { SummonerMasteryService } from './services/summoner-mastery.service';
import { SummonerMatchService } from './services/summoner-match.service';
import { SummonerRankService } from './services/summoner-rank.service';
import { SummonerService } from './services/summoner.service';

@Module({
    imports: [RiotModule],
    controllers: [SummonerController],
    providers: [
        SummonerService,
        SummonerRepository,
        SummonerRankService,
        SummonerRankRepository,
        SummonerMasteryService,
        SummonerMasteryRepository,
        SummonerMatchService,
        MatchRepository,
        SummonerResourceReadRepository,
    ],
})
export class SummonerModule {}
