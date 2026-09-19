import type { MatchTimelineFrame } from '@lynf/shared';

/**
 * The three measures the Duel tab can chart — minions, gold, experience — matched to
 * the field `MatchTimelineFrame` actually reports for each. Damage is deliberately
 * absent: `match-v5`'s timeline never reports a per-minute damage figure, only the
 * final total already shown by the lane-duel band above the chart, so there is no
 * button for it rather than a disabled one.
 */
export const TIMELINE_MEASURES = ['creepScore', 'totalGold', 'xp'] as const;

export type TimelineMeasure = (typeof TIMELINE_MEASURES)[number];

export type LaneGapPoint = {
    minute: number;
    gap: number;
};

/**
 * The player's per-minute lead (positive) or deficit (negative) against their lane
 * opponent, for one measure of the match timeline.
 *
 * Built only from minutes where both the player and the opponent have a reported
 * frame — Riot's timeline is not guaranteed to carry the exact same minute count for
 * every participant — so the series can never pair a player's minute 12 with an
 * opponent's minute 11. A gap of exactly zero is a real point like any other: nothing
 * here special-cases it away, so an even lane stays a visible point on the line
 * instead of a gap in the data.
 */
export function buildLaneGapSeries(
    frames: readonly MatchTimelineFrame[],
    playerPuuid: string,
    opponentPuuid: string,
    measure: TimelineMeasure,
): LaneGapPoint[] {
    const opponentByMinute = new Map<number, number>();

    for (const frame of frames) {
        if (frame.puuid === opponentPuuid) {
            opponentByMinute.set(frame.minute, frame[measure]);
        }
    }

    const points: LaneGapPoint[] = [];

    for (const frame of frames) {
        if (frame.puuid !== playerPuuid) {
            continue;
        }

        const opponentValue = opponentByMinute.get(frame.minute);

        if (opponentValue === undefined) {
            continue;
        }

        points.push({ minute: frame.minute, gap: frame[measure] - opponentValue });
    }

    return points.sort((a, b) => a.minute - b.minute);
}
