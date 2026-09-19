/**
 * The lane order a team breakdown reads in. A participant whose `teamPosition` is not
 * one of these — empty, on Arena and on matches old enough to predate the field — sorts
 * after everyone who has one, in whatever order Riot reported them.
 */
export const TEAM_POSITION_ORDER: readonly string[] = [
    'TOP',
    'JUNGLE',
    'MIDDLE',
    'BOTTOM',
    'UTILITY',
];
