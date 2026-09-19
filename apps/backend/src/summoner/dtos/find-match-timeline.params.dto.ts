import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

import { FindSummonerParamsDto } from './find-summoner.params.dto';

/**
 * Route parameters of `GET /summoners/:region/:gameName/:tagLine/matches/:matchId/timeline`.
 *
 * `matchId` is validated against Riot's own id shape — a platform id, then an
 * underscore, then digits (e.g. `EUW1_1234567890`) — the same shape every id this
 * application ever stores already has: nothing malformed can name a match Lynf tracks,
 * so anything else is refused before it reaches a query.
 */
export class FindMatchTimelineParamsDto extends FindSummonerParamsDto {
    @ApiProperty({ description: "Riot's match id.", example: 'EUW1_1234567890' })
    @Matches(/^[A-Z0-9]+_\d+$/)
    matchId!: string;
}
