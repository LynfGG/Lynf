import { Controller, Get, Param } from '@nestjs/common';
import {
    ApiBadGatewayResponse,
    ApiBadRequestResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiServiceUnavailableResponse,
    ApiTags,
    ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { FindSummonerParamsDto } from '../dtos/find-summoner.params.dto';
import { SummonerProfileDto } from '../dtos/summoner-profile.dto';
import { SummonerService } from '../services/summoner.service';

@ApiTags('summoners')
@Controller('summoners')
export class SummonerController {
    constructor(private readonly summonerService: SummonerService) {}

    @Get(':region/:gameName/:tagLine')
    @ApiOperation({
        summary: 'Look a player up by their Riot ID.',
        description:
            'A stored profile is served while it is fresh. When Riot cannot refresh it, the stored profile is served whatever its age: the 429, 502 and 503 errors only occur when nothing is stored.',
    })
    @ApiOkResponse({ type: SummonerProfileDto })
    @ApiBadRequestResponse({ description: 'The region or the Riot ID is malformed.' })
    @ApiNotFoundResponse({
        description: 'No player has this Riot ID, or they have no profile on this platform.',
    })
    @ApiTooManyRequestsResponse({ description: 'The Riot API rate limit was reached.' })
    @ApiBadGatewayResponse({ description: 'Riot rejected the API key configured on the server.' })
    @ApiServiceUnavailableResponse({
        description: 'The Riot API could not be reached, or answered with an unexpected error.',
    })
    findByRiotId(@Param() params: FindSummonerParamsDto): Promise<SummonerProfileDto> {
        return this.summonerService.findByRiotId(params);
    }
}
