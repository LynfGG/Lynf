import { RANKED_QUEUES, type ERankedQueue, type SummonerRank } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One entry of `GET /summoners/:region/:gameName/:tagLine/ranks`.
 *
 * It implements the shared type, so the two sides cannot drift apart without the
 * compiler noticing.
 */
export class SummonerRankDto implements SummonerRank {
    @ApiProperty({ enum: RANKED_QUEUES, example: 'RANKED_SOLO_5x5' })
    queue!: ERankedQueue;

    @ApiProperty({ example: 'EMERALD' })
    tier!: string;

    @ApiProperty({ example: 'II', description: 'Always I in the apex tiers.' })
    division!: string;

    @ApiProperty({ example: 47 })
    leaguePoints!: number;

    @ApiProperty({ example: 68 })
    wins!: number;

    @ApiProperty({ example: 54 })
    losses!: number;
}
