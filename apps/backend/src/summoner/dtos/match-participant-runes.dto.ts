import type { MatchParticipantRunes } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The three stat-shard fragments of `MatchParticipantRunesDto`.
 *
 * Structurally identical to `MatchParticipantRunes['statPerks']`, which is not itself
 * an exported name a class can implement — `MatchParticipantRunesDto` implementing the
 * whole shared type below is what keeps the two from drifting apart.
 */
export class MatchParticipantStatPerksDto {
    @ApiProperty({ example: 5007 })
    offense!: number;

    @ApiProperty({ example: 5008 })
    flex!: number;

    @ApiProperty({ example: 5001 })
    defense!: number;
}

/**
 * The runes a participant played, as carried by `MatchParticipantSummaryDto`.
 *
 * Numeric ids only, exactly as stored: turning a perk id into its name and icon is the
 * screen's job, the same split already made for `championId` and `items`.
 */
export class MatchParticipantRunesDto implements MatchParticipantRunes {
    @ApiProperty({ description: "The primary tree's id.", example: 8200 })
    primaryStyle!: number;

    @ApiProperty({
        description: "The primary tree's chosen perks, in Riot's own selection order.",
        example: [8230, 8224, 8233, 8236],
        type: [Number],
    })
    primaryPerks!: number[];

    @ApiProperty({ description: "The secondary tree's id.", example: 8300 })
    subStyle!: number;

    @ApiProperty({
        description: "The secondary tree's chosen perks, in Riot's own selection order.",
        example: [8321, 8347],
        type: [Number],
    })
    subPerks!: number[];

    @ApiProperty({ type: MatchParticipantStatPerksDto })
    statPerks!: MatchParticipantStatPerksDto;
}
