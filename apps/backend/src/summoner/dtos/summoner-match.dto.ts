import type { MatchSummary } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

import { MatchParticipantSummaryDto } from './match-participant-summary.dto';

/**
 * One entry of `GET /summoners/:region/:gameName/:tagLine/matches`.
 *
 * It implements the shared type, so the two sides cannot drift apart without the
 * compiler noticing.
 */
export class SummonerMatchDto implements MatchSummary {
    @ApiProperty({ example: 'EUW1_1234567890' })
    matchId!: string;

    @ApiProperty({ description: "Riot's numeric queue id.", example: 420 })
    queueId!: number;

    @ApiProperty({ example: 1_842 })
    durationSeconds!: number;

    @ApiProperty({ description: 'When the match ended.' })
    endedAt!: string;

    @ApiProperty({ type: MatchParticipantSummaryDto })
    player!: MatchParticipantSummaryDto;

    @ApiProperty({
        type: MatchParticipantSummaryDto,
        nullable: true,
        description:
            'The player who held the same position on the other team, or null when none could be identified — some queues and older matches never carry a position.',
    })
    opponent!: MatchParticipantSummaryDto | null;
}
