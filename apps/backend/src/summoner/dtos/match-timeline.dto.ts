import {
    EMatchTimelineItemAction,
    type MatchTimeline,
    type MatchTimelineFrame,
    type MatchTimelineItemEvent,
    type MatchTimelineKill,
    type MatchTimelineSkillLevelUp,
} from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

export class MatchTimelineFrameDto implements MatchTimelineFrame {
    @ApiProperty({ description: 'The participant this minute belongs to.', example: 'puuid-abc' })
    puuid!: string;

    @ApiProperty({
        description: '`0` for the first minute, `1` for the second, and so on.',
        example: 12,
    })
    minute!: number;

    @ApiProperty({ example: 7_450 })
    totalGold!: number;

    @ApiProperty({ description: 'Lane and jungle minions killed, combined.', example: 98 })
    creepScore!: number;

    @ApiProperty({ example: 5_320 })
    xp!: number;

    @ApiProperty({ example: 9 })
    level!: number;
}

export class MatchTimelineSkillLevelUpDto implements MatchTimelineSkillLevelUp {
    @ApiProperty({ example: 'puuid-abc' })
    puuid!: string;

    @ApiProperty({ description: 'Milliseconds into the game.', example: 13_976 })
    timestampMs!: number;

    @ApiProperty({ description: '`0`–`3`: Q, W, E, R.', example: 3 })
    skillSlot!: number;
}

export class MatchTimelineItemEventDto implements MatchTimelineItemEvent {
    @ApiProperty({ example: 'puuid-abc' })
    puuid!: string;

    @ApiProperty({ description: 'Milliseconds into the game.', example: 373_641 })
    timestampMs!: number;

    @ApiProperty({ example: 3040 })
    itemId!: number;

    @ApiProperty({
        enum: EMatchTimelineItemAction,
        description:
            'An undone purchase or sale never produces an event: it is cancelled at extraction.',
        example: EMatchTimelineItemAction.PURCHASED,
    })
    action!: EMatchTimelineItemAction;
}

export class MatchTimelineKillDto implements MatchTimelineKill {
    @ApiProperty({ description: 'Milliseconds into the game.', example: 194_547 })
    timestampMs!: number;

    @ApiProperty({
        nullable: true,
        description: 'Null for the rare kill Riot itself does not attribute to a player.',
        example: 'puuid-abc',
    })
    killerPuuid!: string | null;

    @ApiProperty({ example: 'puuid-def' })
    victimPuuid!: string;

    @ApiProperty({ type: [String], example: ['puuid-ghi'] })
    assistingPuuids!: string[];
}

/**
 * Response of `GET /summoners/:region/:gameName/:tagLine/matches/:matchId/timeline`.
 *
 * It implements the shared type, so the two sides cannot drift apart without the
 * compiler noticing.
 */
export class MatchTimelineDto implements MatchTimeline {
    @ApiProperty({ example: 'EUW1_1234567890' })
    matchId!: string;

    @ApiProperty({
        type: MatchTimelineFrameDto,
        isArray: true,
        description: 'One entry per participant per minute.',
    })
    frames!: MatchTimelineFrameDto[];

    @ApiProperty({ type: MatchTimelineSkillLevelUpDto, isArray: true })
    skillLevelUps!: MatchTimelineSkillLevelUpDto[];

    @ApiProperty({ type: MatchTimelineItemEventDto, isArray: true })
    itemEvents!: MatchTimelineItemEventDto[];

    @ApiProperty({ type: MatchTimelineKillDto, isArray: true })
    kills!: MatchTimelineKillDto[];
}
