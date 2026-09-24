import type { SummonerRank } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

export class SummonerRankDto implements SummonerRank {
    @ApiProperty({ example: 'RANKED_SOLO_5x5' })
    queueType!: string;
    @ApiProperty({ example: 'CHALLENGER' })
    tier!: string;
    @ApiProperty({ example: 'I' })
    rank!: string;
    @ApiProperty({ example: 742 })
    leaguePoints!: number;
    @ApiProperty({ example: 120 })
    wins!: number;
    @ApiProperty({ example: 80 })
    losses!: number;
}
