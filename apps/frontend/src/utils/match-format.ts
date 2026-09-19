const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** `31:42`, or `1:05:12` past the hour — League games cross it rarely, but it happens. */
export function formatMatchDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);
    const paddedSeconds = String(seconds).padStart(2, '0');

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
    }

    return `${minutes}:${paddedSeconds}`;
}

/**
 * The largest unit `Intl.RelativeTimeFormat` should express the gap in, chosen so "2
 * days ago" is said instead of "48 hours ago" — the units and their thresholds a
 * human actually reaches for.
 */
const RELATIVE_TIME_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
];

/** `+23`, `-15` or `0`, always showing its sign except at zero. */
export function formatSignedNumber(value: number, language: string): string {
    return new Intl.NumberFormat(language, { signDisplay: 'exceptZero' }).format(value);
}

/** `13,450`, grouped the way the active language expects. */
export function formatNumber(value: number, language: string): string {
    return new Intl.NumberFormat(language).format(value);
}

/** "3 hours ago", in whichever of the two supported languages is active. */
export function formatRelativeTime(iso: string, language: string): string {
    const elapsedSeconds = (Date.now() - new Date(iso).getTime()) / 1000;
    const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

    for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
        if (elapsedSeconds >= secondsInUnit) {
            return formatter.format(-Math.floor(elapsedSeconds / secondsInUnit), unit);
        }
    }

    return formatter.format(0, 'minute');
}
