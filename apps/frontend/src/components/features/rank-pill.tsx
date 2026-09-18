import { ERankedQueue, type SummonerRank } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

type RankPillProps = {
    rank: SummonerRank;
};

/** Apex tiers have a single division; Riot still answers `I`, and showing it is noise. */
const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];

/**
 * `EMERALD` becomes `Emerald`. Done here, in JavaScript, on the tier alone: letting CSS
 * `capitalize` the whole "EMERALD II" pair would title-case the Roman numeral too, and
 * "II" becomes "Ii".
 */
function toTitleCase(tier: string) {
    return tier.charAt(0) + tier.slice(1).toLowerCase();
}

const QUEUE_STYLES: Record<ERankedQueue, string> = {
    [ERankedQueue.SOLO]: 'bg-solo-surface text-solo',
    [ERankedQueue.FLEX]: 'bg-flex-surface text-flex',
};

/** One ranked queue, as a pill next to the player's name. */
export default function RankPill({ rank }: Readonly<RankPillProps>) {
    const { t } = useTranslation('summoner');

    const tier = toTitleCase(rank.tier);
    const standing = APEX_TIERS.includes(rank.tier) ? tier : `${tier} ${rank.division}`;

    const content =
        rank.queue === ERankedQueue.FLEX
            ? t('profile.ranks.pill.flex', {
                  queue: t(`profile.ranks.queue.${rank.queue}`),
                  standing,
              })
            : t('profile.ranks.pill.solo', {
                  standing,
                  lp: t('profile.ranks.leaguePoints', { points: rank.leaguePoints }),
              });

    return (
        <span
            className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ${QUEUE_STYLES[rank.queue]}`}
        >
            {content}
        </span>
    );
}
