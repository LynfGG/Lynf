import {
    isRiotIdLengthValid,
    normalizeRiotId,
    PLATFORM_REGIONS,
    type RiotIdLookup,
} from '@lynf/shared';

/**
 * Recently viewed players live in the browser's local storage, never in the database.
 * Lynf has no user accounts: everyone who looks up a player is anonymous, and turning
 * that into a server-side log of who searched for whom would be a navigation history
 * with nothing to justify it. Local storage stays on the visitor's machine, never
 * crosses the network, and disappears when they clear their browser data — the
 * right answer, not a shortcut around a database column.
 */
const STORAGE_KEY = 'lynf:recent-searches';

const MAX_ENTRIES = 5;

export type RecentSearch = RiotIdLookup;

const PLATFORM_REGION_SET = new Set<string>(PLATFORM_REGIONS);

/**
 * Nothing read back from storage is trusted just because this module is the one that
 * wrote it. A previous version of the site — or a browser extension, or a visitor
 * poking at devtools — could have left anything under this key, so every candidate
 * entry is checked field by field before it is allowed anywhere near the page.
 */
function isRecentSearch(value: unknown): value is RecentSearch {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
        typeof candidate.region === 'string' &&
        PLATFORM_REGION_SET.has(candidate.region) &&
        typeof candidate.gameName === 'string' &&
        typeof candidate.tagLine === 'string' &&
        isRiotIdLengthValid(candidate.gameName, candidate.tagLine)
    );
}

/**
 * Riot IDs are compared case-insensitively everywhere in this project (see the query
 * keys under `hooks/`), so the same player searched with different casing is still
 * the same entry here.
 */
function isSameSearch(a: RecentSearch, b: RecentSearch): boolean {
    const normalizedA = normalizeRiotId(a.gameName, a.tagLine);
    const normalizedB = normalizeRiotId(b.gameName, b.tagLine);

    return (
        a.region === b.region &&
        normalizedA.gameName === normalizedB.gameName &&
        normalizedA.tagLine === normalizedB.tagLine
    );
}

/**
 * Both reading and writing are wrapped: local storage can throw in private browsing,
 * when it is disabled outright, or when its quota is full. Any of that should leave
 * the page working without the list, never break it and never surface an error the
 * visitor did nothing to deserve.
 */
function readAll(): RecentSearch[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isRecentSearch);
    } catch {
        return [];
    }
}

function writeAll(entries: RecentSearch[]): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // Storage unavailable or full: the visit is simply not remembered.
    }
}

/** The recently viewed players, most recent first. Never throws. */
export function getRecentSearches(): RecentSearch[] {
    return readAll();
}

/**
 * Records a visit: the player moves to the front if already present (case-insensitive,
 * so it never duplicates), and the list is capped at `MAX_ENTRIES`. Returns the list
 * that was written, so a caller can update its own state from it directly.
 */
export function addRecentSearch(lookup: RiotIdLookup): RecentSearch[] {
    const withoutDuplicate = readAll().filter((entry) => !isSameSearch(entry, lookup));
    const next = [lookup, ...withoutDuplicate].slice(0, MAX_ENTRIES);

    writeAll(next);

    return next;
}

/** Removes one entry. Returns the list that was written. */
export function removeRecentSearch(lookup: RiotIdLookup): RecentSearch[] {
    const next = readAll().filter((entry) => !isSameSearch(entry, lookup));

    writeAll(next);

    return next;
}

/** Clears the whole list. */
export function clearRecentSearches(): void {
    writeAll([]);
}
