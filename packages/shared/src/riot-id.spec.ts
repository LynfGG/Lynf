import {
    buildRiotIdSegment,
    isRiotIdLengthValid,
    normalizeRiotId,
    splitRiotIdSegment,
} from './riot-id.js';
import { RIOT_ID_LENGTH } from './summoner.js';

describe('normalizeRiotId', () => {
    it('lowercases both parts', () => {
        expect(normalizeRiotId('Faker', 'KR1')).toEqual({ gameName: 'faker', tagLine: 'kr1' });
    });

    it('leaves an already lower-case Riot ID unchanged', () => {
        expect(normalizeRiotId('faker', 'kr1')).toEqual({ gameName: 'faker', tagLine: 'kr1' });
    });
});

describe('isRiotIdLengthValid', () => {
    const validGameName = 'a'.repeat(RIOT_ID_LENGTH.gameName.min);
    const validTagLine = 'a'.repeat(RIOT_ID_LENGTH.tagLine.min);

    it('accepts a game name and tag line exactly at the minimum', () => {
        expect(isRiotIdLengthValid(validGameName, validTagLine)).toBe(true);
    });

    it('accepts a game name and tag line exactly at the maximum', () => {
        expect(
            isRiotIdLengthValid(
                'a'.repeat(RIOT_ID_LENGTH.gameName.max),
                'a'.repeat(RIOT_ID_LENGTH.tagLine.max),
            ),
        ).toBe(true);
    });

    it('rejects a game name one character under the minimum', () => {
        expect(isRiotIdLengthValid('a'.repeat(RIOT_ID_LENGTH.gameName.min - 1), validTagLine)).toBe(
            false,
        );
    });

    it('rejects a game name one character over the maximum', () => {
        expect(isRiotIdLengthValid('a'.repeat(RIOT_ID_LENGTH.gameName.max + 1), validTagLine)).toBe(
            false,
        );
    });

    it('rejects a tag line one character under the minimum', () => {
        expect(isRiotIdLengthValid(validGameName, 'a'.repeat(RIOT_ID_LENGTH.tagLine.min - 1))).toBe(
            false,
        );
    });

    it('rejects a tag line one character over the maximum', () => {
        expect(isRiotIdLengthValid(validGameName, 'a'.repeat(RIOT_ID_LENGTH.tagLine.max + 1))).toBe(
            false,
        );
    });
});

describe('buildRiotIdSegment', () => {
    it('joins the encoded parts with a dash', () => {
        expect(buildRiotIdSegment('Faker', 'KR1')).toBe('Faker-KR1');
    });

    it('encodes a `#` in either part so it can never open a URL fragment', () => {
        expect(buildRiotIdSegment('a#b', 'c#d')).toBe('a%23b-c%23d');
    });

    it('encodes a game name containing spaces or other reserved characters', () => {
        expect(buildRiotIdSegment('Team Liquid', 'KR1')).toBe('Team%20Liquid-KR1');
    });
});

describe('splitRiotIdSegment', () => {
    // `useParams()` on the front end already URL-decodes a route segment before this
    // function ever sees it, the same way `buildRiotIdSegment`'s output is decoded by
    // the browser once it lands in the address bar — so these cases work on plain,
    // decoded text, never on the percent-encoded form `buildRiotIdSegment` produces.

    it('splits a simple segment on its dash', () => {
        expect(splitRiotIdSegment('Faker-KR1')).toEqual({ gameName: 'Faker', tagLine: 'KR1' });
    });

    it('splits on the last dash, so a game name containing dashes survives', () => {
        expect(splitRiotIdSegment('a-b-c-KR1')).toEqual({ gameName: 'a-b-c', tagLine: 'KR1' });
    });

    it('rejects a segment carrying an unencoded `#`', () => {
        expect(splitRiotIdSegment('Faker#KR1')).toBeUndefined();
    });

    it('rejects a segment with no dash at all', () => {
        expect(splitRiotIdSegment('FakerKR1')).toBeUndefined();
    });

    it('rejects a segment whose only dash opens it', () => {
        expect(splitRiotIdSegment('-KR1')).toBeUndefined();
    });

    it('rejects a segment whose last dash closes it', () => {
        expect(splitRiotIdSegment('Faker-')).toBeUndefined();
    });

    it('rejects a segment whose game name is too short', () => {
        expect(
            splitRiotIdSegment(`${'a'.repeat(RIOT_ID_LENGTH.gameName.min - 1)}-KR1`),
        ).toBeUndefined();
    });

    it('rejects a segment whose tag line is too long', () => {
        expect(
            splitRiotIdSegment(`Faker-${'a'.repeat(RIOT_ID_LENGTH.tagLine.max + 1)}`),
        ).toBeUndefined();
    });
});
