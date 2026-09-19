import type { MatchTimelineSkillLevelUp } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import {
    buildSkillOrderGrid,
    SKILL_ORDER_LEVELS,
    SKILL_SLOTS,
    ULTIMATE_SLOT,
    type SkillSlot,
} from '../../utils/skill-order';

type MatchDetailSkillOrderProps = {
    skillLevelUps: readonly MatchTimelineSkillLevelUp[];
    puuid: string;
};

const SLOT_LABEL_KEYS: Record<SkillSlot, string> = {
    1: 'q',
    2: 'w',
    3: 'e',
    4: 'r',
};

/**
 * The skill order, as a grid: one row per ability (Q, W, E, R), one column per champion
 * level, the cell for whichever ability was raised at that level marked with the level
 * itself. The ultimate row reads differently from the other three — gold rather than
 * grey — since missing an R point matters far more than missing a minor one.
 *
 * Eighteen columns do not fit a 390px screen at a readable size: the grid scrolls
 * horizontally within its own box instead of shrinking illegibly or widening the page.
 */
export default function MatchDetailSkillOrder({
    skillLevelUps,
    puuid,
}: Readonly<MatchDetailSkillOrderProps>) {
    const { t } = useTranslation('summoner');
    const grid = buildSkillOrderGrid(skillLevelUps, puuid);
    const levels = Array.from({ length: SKILL_ORDER_LEVELS }, (_, index) => index + 1);

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">
                {t('profile.matches.detail.stuff.skillOrder.heading')}
            </h3>

            <div className="overflow-x-auto">
                <table className="border-separate border-spacing-1">
                    <thead>
                        <tr>
                            <th scope="col" className="w-6" />
                            {levels.map((level) => (
                                <th
                                    key={level}
                                    scope="col"
                                    className="w-6 text-center text-[10px] font-normal text-ink-muted"
                                >
                                    {level}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {SKILL_SLOTS.map((slot) => {
                            const isUltimate = slot === ULTIMATE_SLOT;
                            const slotLabel = t(
                                `profile.matches.detail.stuff.skillOrder.slots.${SLOT_LABEL_KEYS[slot]}`,
                            );

                            return (
                                <tr key={slot}>
                                    <th
                                        scope="row"
                                        className={`w-6 pr-2 text-left text-xs font-semibold ${
                                            isUltimate ? 'text-gold' : 'text-ink-muted'
                                        }`}
                                    >
                                        {slotLabel}
                                    </th>
                                    {grid[slot].map((level, index) => (
                                        <td key={index}>
                                            <div
                                                className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ${
                                                    level
                                                        ? isUltimate
                                                            ? 'bg-gold text-ground'
                                                            : 'bg-surface-raised text-ink'
                                                        : 'border border-line'
                                                }`}
                                            >
                                                {level !== null && (
                                                    <span aria-hidden="true">{level}</span>
                                                )}
                                                {level !== null && (
                                                    <span className="sr-only">
                                                        {t(
                                                            'profile.matches.detail.stuff.skillOrder.cellLabel',
                                                            { skill: slotLabel, level },
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
