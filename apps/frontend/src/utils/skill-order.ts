import type { MatchTimelineSkillLevelUp } from '@lynf/shared';

/**
 * `1`–`4`: Q, W, E, R.
 *
 * `MatchTimelineSkillLevelUp.skillSlot`'s own comment says `0`–`3` — verified against a
 * live timeline response (`GET .../matches/:matchId/timeline`) while building this
 * screen, Riot's own field, and therefore this application's stored one, is `1`–`4`.
 * That comment is stale; nothing here trusts it, this constant is built from what the
 * running server actually returns.
 */
export const SKILL_SLOTS = [1, 2, 3, 4] as const;

export type SkillSlot = (typeof SKILL_SLOTS)[number];

/** The ultimate is always slot `4` and reads differently from the other three. */
export const ULTIMATE_SLOT: SkillSlot = 4;

/** A champion never levels past 18 in a finished match. */
export const SKILL_ORDER_LEVELS = 18;

/**
 * One row per skill slot, one entry per champion level (index `0` is level 1): the
 * level number when that level put a point into this slot, `null` otherwise.
 */
export type SkillOrderGrid = Record<SkillSlot, Array<number | null>>;

/**
 * The eighteen-level skill order grid for one participant.
 *
 * Riot's timeline reports one skill level-up event per champion level, in the order
 * they happened — never more than one per level, since a champion only ever gains one
 * skill point per level. The Nth chronological event for a participant is therefore
 * champion level N, which is what turns a flat event list into level-indexed columns.
 *
 * A `skillSlot` outside `1`–`4` — none observed, but nothing guarantees Riot never adds
 * one — is skipped rather than crashing the tab.
 */
export function buildSkillOrderGrid(
    skillLevelUps: readonly MatchTimelineSkillLevelUp[],
    puuid: string,
): SkillOrderGrid {
    const grid = {
        1: Array.from({ length: SKILL_ORDER_LEVELS }, () => null),
        2: Array.from({ length: SKILL_ORDER_LEVELS }, () => null),
        3: Array.from({ length: SKILL_ORDER_LEVELS }, () => null),
        4: Array.from({ length: SKILL_ORDER_LEVELS }, () => null),
    } as SkillOrderGrid;

    const ownEvents = skillLevelUps
        .filter((event) => event.puuid === puuid)
        .sort((a, b) => a.timestampMs - b.timestampMs);

    ownEvents.forEach((event, index) => {
        const level = index + 1;

        if (level > SKILL_ORDER_LEVELS) {
            return;
        }

        if (!(SKILL_SLOTS as readonly number[]).includes(event.skillSlot)) {
            return;
        }

        const slot = event.skillSlot as SkillSlot;
        grid[slot][level - 1] = level;
    });

    return grid;
}
