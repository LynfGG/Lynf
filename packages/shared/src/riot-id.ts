import { RIOT_ID_LENGTH } from './summoner.js';

/**
 * Riot IDs ignore case. This is the one place that lowercases a Riot ID — used for
 * storage keys on the back end and cache keys on the front end, so that `Faker#KR1`
 * and `faker#kr1` are always treated as the same player.
 */
export function normalizeRiotId(
    gameName: string,
    tagLine: string,
): { gameName: string; tagLine: string } {
    return { gameName: gameName.toLowerCase(), tagLine: tagLine.toLowerCase() };
}

/** True when both parts of a Riot ID satisfy Riot's length bounds. */
export function isRiotIdLengthValid(gameName: string, tagLine: string): boolean {
    return (
        gameName.length >= RIOT_ID_LENGTH.gameName.min &&
        gameName.length <= RIOT_ID_LENGTH.gameName.max &&
        tagLine.length >= RIOT_ID_LENGTH.tagLine.min &&
        tagLine.length <= RIOT_ID_LENGTH.tagLine.max
    );
}

/**
 * Builds the URL segment for a Riot ID: `gameName-tagLine`. Each part is encoded on its
 * own before joining, so a `#` (or a literal `-` introduced by encoding) inside either
 * part can never be mistaken for the separator or open a URL fragment.
 */
export function buildRiotIdSegment(gameName: string, tagLine: string): string {
    return `${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`;
}

/**
 * Splits a Riot ID's URL segment — as built by `buildRiotIdSegment` — back into its game
 * name and tag line. `undefined` when the segment cannot be a valid Riot ID.
 *
 * `#` is the real separator of a Riot ID and can never appear in the ID itself, so a
 * decoded `#` indicates the URL was built from an unencoded Riot ID (or tampered with)
 * rather than from a properly encoded game name and tag line — that check runs before
 * the split. Only the *last* dash separates the two parts, because a game name may
 * contain dashes and a tag line may not.
 */
export function splitRiotIdSegment(
    segment: string,
): { gameName: string; tagLine: string } | undefined {
    if (segment.includes('#')) {
        return undefined;
    }

    const separator = segment.lastIndexOf('-');

    if (separator <= 0 || separator === segment.length - 1) {
        return undefined;
    }

    const gameName = segment.slice(0, separator);
    const tagLine = segment.slice(separator + 1);

    if (!isRiotIdLengthValid(gameName, tagLine)) {
        return undefined;
    }

    return { gameName, tagLine };
}
