/**
 * Riot's numeric queue ids, mapped to the translation key each one shows under
 * `profile.matches.queue`. Only the queues the demo player and casual accounts
 * realistically show are named; anything else falls back to a neutral "Other queue"
 * label — never the raw id, and never run through a numeric formatter, since a queue
 * id is an identifier, not a quantity.
 *
 * Riot's own list is long and moves (Arena alone has changed id more than once), so
 * this stays a short, deliberately incomplete allow-list rather than an attempt to
 * mirror it.
 */
export const MATCH_QUEUE_NAMES: Record<number, string> = {
    400: 'normalDraft',
    420: 'soloDuo',
    430: 'normalBlind',
    440: 'flex',
    450: 'aram',
    700: 'clash',
    900: 'urf',
    1750: 'arena',
    870: 'coopVsAi',
    880: 'coopVsAi',
    890: 'coopVsAi',
};
