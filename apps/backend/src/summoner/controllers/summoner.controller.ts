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
import { SummonerMasteryDto } from '../dtos/summoner-mastery.dto';
import { SummonerProfileDto } from '../dtos/summoner-profile.dto';
import { SummonerRankDto } from '../dtos/summoner-rank.dto';
import { SummonerMasteryService } from '../services/summoner-mastery.service';
import { SummonerRankService } from '../services/summoner-rank.service';
import { SummonerService } from '../services/summoner.service';

@ApiTags('summoners')
@Controller('summoners')
export class SummonerController {
    constructor(
        private readonly summonerService: SummonerService,
        private readonly summonerRankService: SummonerRankService,
        private readonly summonerMasteryService: SummonerMasteryService,
    ) {}

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

    @Get(':region/:gameName/:tagLine/ranks')
    @ApiOperation({
        summary: 'Read the ranked standings of a player.',
        description:
            'An empty list means the player is ranked in neither queue — it is an answer, not an absence. Stored standings are served while they are fresh, and when Riot cannot refresh them, whatever their age: the 429, 502 and 503 errors only occur when nothing is stored.',
    })
    @ApiOkResponse({ type: SummonerRankDto, isArray: true })
    @ApiBadRequestResponse({ description: 'The region or the Riot ID is malformed.' })
    @ApiNotFoundResponse({
        description: 'No player has this Riot ID, or they have no profile on this platform.',
    })
    @ApiTooManyRequestsResponse({ description: 'The Riot API rate limit was reached.' })
    @ApiBadGatewayResponse({ description: 'Riot rejected the API key configured on the server.' })
    @ApiServiceUnavailableResponse({
        description: 'The Riot API could not be reached, or answered with an unexpected error.',
    })
    findRanksByRiotId(@Param() params: FindSummonerParamsDto): Promise<SummonerRankDto[]> {
        return this.summonerRankService.findByRiotId(params);
    }

    @Get(':region/:gameName/:tagLine/masteries')
    @ApiOperation({
        summary: 'Read the three champions a player has mastered the most.',
        description:
            'An empty list means the player has never played a game — it is an answer, not an absence. Stored masteries are served while they are fresh, and when Riot cannot refresh them, whatever their age: the 429, 502 and 503 errors only occur when nothing is stored.',
    })
    @ApiOkResponse({ type: SummonerMasteryDto, isArray: true })
    @ApiBadRequestResponse({ description: 'The region or the Riot ID is malformed.' })
    @ApiNotFoundResponse({
        description: 'No player has this Riot ID, or they have no profile on this platform.',
    })
    @ApiTooManyRequestsResponse({ description: 'The Riot API rate limit was reached.' })
    @ApiBadGatewayResponse({ description: 'Riot rejected the API key configured on the server.' })
    @ApiServiceUnavailableResponse({
        description: 'The Riot API could not be reached, or answered with an unexpected error.',
    })
    findMasteriesByRiotId(@Param() params: FindSummonerParamsDto): Promise<SummonerMasteryDto[]> {
        return this.summonerMasteryService.findByRiotId(params);
    }
}
