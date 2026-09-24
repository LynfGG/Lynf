import { Controller, Get, Param } from '@nestjs/common';
import { FindSummonerParamsDto } from '../dtos/find-summoner.params.dto';
import { SummonerRankDto } from '../dtos/summoner-rank.dtos';
import { SummonerRankService } from '../services/summoner-rank.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('summoners')
@Controller('summoners')
export class SummonerRankController {
    constructor(private readonly summonerRankService: SummonerRankService) {}
    @Get(':region/:gameName/:tagLine/:rank')
    @ApiOperation({
        summary: "Look a player's rank up by their Riot ID.",
        description:
            'A stored rank is served while it is fresh. When Riot cannot refresh it, the stored rank is served whatever its age: the 429, 502 and 503 errors only occur when nothing is stored.',
    })
    @ApiOkResponse({ type: SummonerRankDto })
    findRankByRiotId(@Param() params: FindSummonerParamsDto): Promise<SummonerRankDto> {
        return this.summonerRankService.findByRiotId(params);
    }
}
