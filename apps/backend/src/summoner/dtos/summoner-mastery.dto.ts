import type { ChampionMastery } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One entry of `GET /summoners/:region/:gameName/:tagLine/masteries`.
 *
 * It implements the shared type, so the two sides cannot drift apart without the
 * compiler noticing.
 */
export class SummonerMasteryDto implements ChampionMastery {
    @ApiProperty({ description: "Riot's numeric champion id.", example: 103 })
    championId!: number;

    @ApiProperty({ example: 7 })
    championLevel!: number;

    @ApiProperty({ example: 245_312 })
    championPoints!: number;

    @ApiProperty({ description: 'When this champion was last played.' })
    lastPlayTime!: string;
}
