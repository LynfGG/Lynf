import { EPlatformRegion } from '@lynf/shared';

/**
 * How players name each platform — EUW rather than euw1. These are proper names, the
 * same in every language, so they are not translated.
 */
export const REGION_LABELS = Object.fromEntries(
    Object.entries(EPlatformRegion).map(([label, region]) => [region, label]),
) as Record<EPlatformRegion, string>;
