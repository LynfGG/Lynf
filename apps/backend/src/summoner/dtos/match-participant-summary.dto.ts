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
    @ApiProperty({ description: "The player's own puuid, for this match.", example: 'puuid-abc' })
    puuid!: string;

    @ApiProperty({ description: 'The Riot ID reported for this match.', example: 'Faker' })
    riotIdGameName!: string;

    @ApiProperty({ example: 'KR1' })
    riotIdTagline!: string;

    @ApiProperty({
        description:
            "Riot's numeric team id — 100 or 200 on Summoner's Rift, more on modes with several teams.",
        example: 100,
    })
    teamId!: number;

    @ApiProperty({
        description:
            '`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`, or empty when Riot did not report one.',
        example: 'MIDDLE',
    })
    teamPosition!: string;

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

    @ApiProperty({ example: 21_300 })
    totalDamageDealtToChampions!: number;

    @ApiProperty({
        description: "Seven item slots, trinket included, in Riot's own order. 0 is empty.",
        example: [3157, 6653, 0, 0, 0, 0, 3340],
        type: [Number],
    })
    items!: number[];
}
