import type { MatchParticipantSummary } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One side of a match — the tracked player, or their lane opponent — as carried by
 * `SummonerMatchDto`.
 *
 * It implements the shared type, so the two sides cannot drift apart without the
 * compiler noticing.
 */
export class MatchParticipantSummaryDto implements MatchParticipantSummary {
    @ApiProperty({ description: "Riot's numeric champion id.", example: 103 })
    championId!: number;

    @ApiProperty({ example: true })
    win!: boolean;

    @ApiProperty({ example: 8 })
    kills!: number;

    @ApiProperty({ example: 2 })
    deaths!: number;

    @ApiProperty({ example: 9 })
    assists!: number;

    @ApiProperty({ description: 'Lane and jungle minions killed, combined.', example: 182 })
    creepScore!: number;

    @ApiProperty({ example: 13_450 })
    goldEarned!: number;

    @ApiProperty({
        description: "Seven item slots, trinket included, in Riot's own order. 0 is empty.",
        example: [3157, 6653, 0, 0, 0, 0, 3340],
        type: [Number],
    })
    items!: number[];
}
