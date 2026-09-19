import type { MatchParticipantSummary, MatchTimelineFrame, MatchTimelineKill } from '@lynf/shared';
import { SkullIcon, SwordsIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    buildLaneGapSeries,
    TIMELINE_MEASURES,
    type TimelineMeasure,
} from '../../utils/lane-gap-series';
import { formatMatchDuration, formatSignedNumber } from '../../utils/match-format';

const MARKER_ICON_SIZE = 14;
/** A flat gap never draws thinner than this share of the plot's half-height, the same
 * floor idea `duel-band.tsx` already applies to its own bars. */
const MIN_DOMAIN = 10;
const MEASURE_LABEL_KEYS: Record<TimelineMeasure, string> = {
    creepScore: 'profile.matches.detail.duel.creepScore',
    totalGold: 'profile.matches.detail.duel.gold',
    xp: 'profile.matches.detail.duel.xp',
};

type MatchDetailDuelChartProps = {
    frames: readonly MatchTimelineFrame[];
    kills: readonly MatchTimelineKill[];
    player: MatchParticipantSummary;
    opponent: MatchParticipantSummary;
    language: string;
};

type Marker = {
    key: string;
    xPercent: number;
    yPercent: number;
    kind: 'elimination' | 'death';
    time: string;
};

/** Finds the chart's y-position (0–100, top to bottom) for a given minute, snapping to
 * the series' nearest reported minute so a kill between two frames still lands on the
 * line rather than floating off it. */
function yPercentAtMinute(
    series: readonly { minute: number; gap: number }[],
    minute: number,
    toYPercent: (gap: number) => number,
): number | undefined {
    if (series.length === 0) {
        return undefined;
    }

    let closest = series[0];

    for (const point of series) {
        if (Math.abs(point.minute - minute) < Math.abs(closest.minute - minute)) {
            closest = point;
        }
    }

    return toYPercent(closest.gap);
}

/**
 * The minute-by-minute lane gap chart: the player's lead or deficit against their lane
 * opponent, for one of three measures (minions, gold, experience — never damage, which
 * Riot only ever reports as a final total). Above the horizontal midline the player is
 * ahead, below it they are behind; a perfectly even minute still draws as a point on
 * that midline rather than a hole in the line.
 *
 * The player's own eliminations and deaths are marked on the line with two distinct
 * icon shapes — never the same shape recoloured — so the chart still reads for someone
 * who cannot tell the two marker colours apart.
 *
 * Positioned entirely in percentages of its own box rather than inside the chart's own
 * (non-uniformly scaled) SVG viewport, so the icons never stretch with the curve.
 */
export default function MatchDetailDuelChart({
    frames,
    kills,
    player,
    opponent,
    language,
}: Readonly<MatchDetailDuelChartProps>) {
    const { t } = useTranslation('summoner');
    const [measure, setMeasure] = useState<TimelineMeasure>('creepScore');

    const series = buildLaneGapSeries(frames, player.puuid, opponent.puuid, measure);
    const maxMinute = Math.max(1, ...series.map((point) => point.minute));
    const maxAbsGap = Math.max(MIN_DOMAIN, ...series.map((point) => Math.abs(point.gap)));

    const toXPercent = (minute: number) => (minute / maxMinute) * 100;
    const toYPercent = (gap: number) => 50 - (gap / maxAbsGap) * 50;

    const firstPoint = series.length > 0 ? series[0] : undefined;
    const lastPoint = series.length > 0 ? series[series.length - 1] : undefined;

    const linePoints = series.map(
        (point) => `${toXPercent(point.minute)},${toYPercent(point.gap)}`,
    );
    const areaPoints =
        firstPoint && lastPoint
            ? [
                  `${toXPercent(firstPoint.minute)},50`,
                  ...linePoints,
                  `${toXPercent(lastPoint.minute)},50`,
              ]
            : [];

    const markers: Marker[] = kills
        .filter((kill) => kill.killerPuuid === player.puuid || kill.victimPuuid === player.puuid)
        .map((kill) => {
            const minute = kill.timestampMs / 60_000;
            const yPercent = yPercentAtMinute(series, minute, toYPercent);

            if (yPercent === undefined) {
                return undefined;
            }

            const kind: Marker['kind'] =
                kill.killerPuuid === player.puuid ? 'elimination' : 'death';

            return {
                key: `${kind}-${kill.timestampMs}`,
                xPercent: toXPercent(minute),
                yPercent,
                kind,
                time: formatMatchDuration(Math.round(kill.timestampMs / 1000)),
            };
        })
        .filter((marker): marker is Marker => marker !== undefined);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">
                    {t('profile.matches.detail.duel.timeline.heading')}
                </h3>

                <div
                    className="flex gap-1.5"
                    role="group"
                    aria-label={t('profile.matches.detail.duel.timeline.heading')}
                >
                    {TIMELINE_MEASURES.map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={measure === option}
                            onClick={() => setMeasure(option)}
                            className={`h-7 shrink-0 rounded-full px-2.5 text-xs font-semibold transition ${
                                measure === option
                                    ? 'bg-gold text-ground'
                                    : 'border border-line text-ink-muted hover:text-ink'
                            }`}
                        >
                            {t(MEASURE_LABEL_KEYS[option])}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-muted">
                    {t('profile.matches.detail.duel.timeline.hint')}
                </p>

                {lastPoint && (
                    <p
                        className={`text-xs font-semibold ${
                            lastPoint.gap === 0
                                ? 'text-ink-muted'
                                : lastPoint.gap > 0
                                  ? 'text-win'
                                  : 'text-loss'
                        }`}
                    >
                        {lastPoint.gap === 0
                            ? t('profile.matches.detail.duel.even')
                            : t('profile.matches.detail.duel.gap', {
                                  value: formatSignedNumber(lastPoint.gap, language),
                              })}
                    </p>
                )}
            </div>

            <div className="relative h-40 w-full sm:h-48">
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                    aria-hidden="true"
                >
                    <line
                        x1="0"
                        y1="50"
                        x2="100"
                        y2="50"
                        className="stroke-line"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                    />

                    {areaPoints.length > 0 && (
                        <>
                            <clipPath id="duel-chart-clip-above">
                                <rect x="0" y="0" width="100" height="50" />
                            </clipPath>
                            <clipPath id="duel-chart-clip-below">
                                <rect x="0" y="50" width="100" height="50" />
                            </clipPath>

                            <polygon
                                points={areaPoints.join(' ')}
                                className="fill-win"
                                opacity="0.18"
                                clipPath="url(#duel-chart-clip-above)"
                            />
                            <polygon
                                points={areaPoints.join(' ')}
                                className="fill-loss"
                                opacity="0.18"
                                clipPath="url(#duel-chart-clip-below)"
                            />

                            <polyline
                                points={linePoints.join(' ')}
                                fill="none"
                                className="stroke-win"
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                                clipPath="url(#duel-chart-clip-above)"
                            />
                            <polyline
                                points={linePoints.join(' ')}
                                fill="none"
                                className="stroke-loss"
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                                clipPath="url(#duel-chart-clip-below)"
                            />
                        </>
                    )}
                </svg>

                {markers.map((marker) => {
                    const Icon = marker.kind === 'elimination' ? SwordsIcon : SkullIcon;
                    const label = t(
                        marker.kind === 'elimination'
                            ? 'profile.matches.detail.duel.timeline.eliminationAt'
                            : 'profile.matches.detail.duel.timeline.deathAt',
                        { time: marker.time },
                    );

                    return (
                        <div
                            key={marker.key}
                            role="img"
                            aria-label={label}
                            title={label}
                            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface ${
                                marker.kind === 'elimination' ? 'text-win' : 'text-loss'
                            }`}
                            style={{
                                left: `${marker.xPercent}%`,
                                top: `${marker.yPercent}%`,
                                width: MARKER_ICON_SIZE + 6,
                                height: MARKER_ICON_SIZE + 6,
                            }}
                        >
                            <Icon size={MARKER_ICON_SIZE} aria-hidden="true" />
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between text-[10px] text-ink-muted">
                <span>0:00</span>
                <span>{formatMatchDuration(maxMinute * 60)}</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                    <SwordsIcon size={MARKER_ICON_SIZE} aria-hidden="true" className="text-win" />
                    {t('profile.matches.detail.duel.timeline.elimination')}
                </span>
                <span className="flex items-center gap-1.5">
                    <SkullIcon size={MARKER_ICON_SIZE} aria-hidden="true" className="text-loss" />
                    {t('profile.matches.detail.duel.timeline.death')}
                </span>
            </div>
        </div>
    );
}
