import {
    PLATFORM_REGIONS,
    RIOT_ID_LENGTH,
    type EPlatformRegion,
    type RiotIdLookup,
} from '@lynf/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

/** Route parameters of `GET /summoners/:region/:gameName/:tagLine`. */
export class FindSummonerParamsDto implements RiotIdLookup {
    @ApiProperty({
        description: 'Platform the player plays on.',
        enum: PLATFORM_REGIONS,
        example: 'euw1',
    })
    @IsIn(PLATFORM_REGIONS)
    region!: EPlatformRegion;

    @ApiProperty({
        description: 'The part of the Riot ID before the #.',
        example: 'Faker',
        minLength: RIOT_ID_LENGTH.gameName.min,
        maxLength: RIOT_ID_LENGTH.gameName.max,
    })
    @IsString()
    @Length(RIOT_ID_LENGTH.gameName.min, RIOT_ID_LENGTH.gameName.max)
    gameName!: string;

    @ApiProperty({
        description: 'The part of the Riot ID after the #.',
        example: 'KR1',
        minLength: RIOT_ID_LENGTH.tagLine.min,
        maxLength: RIOT_ID_LENGTH.tagLine.max,
    })
    @IsString()
    @Length(RIOT_ID_LENGTH.tagLine.min, RIOT_ID_LENGTH.tagLine.max)
    tagLine!: string;
}
