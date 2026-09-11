import { PLATFORM_REGIONS, type EPlatformRegion, type SummonerProfile } from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The response of `GET /summoners/:region/:gameName/:tagLine`.
 *
 * It implements the shared type, so the front end and the back end cannot drift
 * apart without the compiler noticing.
 */
export class SummonerProfileDto implements SummonerProfile {
    @ApiProperty({ description: 'The stable identifier Riot gives the account.' })
    puuid!: string;

    @ApiProperty({ example: 'Faker' })
    gameName!: string;

    @ApiProperty({ example: 'KR1' })
    tagLine!: string;

    @ApiProperty({ enum: PLATFORM_REGIONS, example: 'euw1' })
    region!: EPlatformRegion;

    @ApiProperty({ description: 'Identifier of the profile icon, as served by Data Dragon.' })
    profileIconId!: number;

    @ApiProperty({ example: 742 })
    summonerLevel!: number;

    @ApiProperty({ description: 'When this profile was last refreshed from Riot.' })
    updatedAt!: string;
}
