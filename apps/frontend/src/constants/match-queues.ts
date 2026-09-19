/**
 * Riot's numeric queue ids, mapped to the translation key each one shows under
 * `profile.matches.queue`. Only the queues the demo player and casual accounts
 * realistically show are named; anything else falls back to a generic "Queue {{id}}"
 * label rather than a raw, untranslated number.
 */
export const MATCH_QUEUE_NAMES: Record<number, string> = {
    400: 'normalDraft',
    420: 'soloDuo',
    430: 'normalBlind',
    440: 'flex',
    450: 'aram',
    700: 'clash',
    900: 'urf',
};
