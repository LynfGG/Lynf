import { type SummonerRank } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

type RankCardProps = {
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

export default function RankCard({ rank }: Readonly<RankCardProps>) {
    const { t } = useTranslation('summoner');

    const games = rank.wins + rank.losses;
    const winRate = games === 0 ? 0 : Math.round((rank.wins / games) * 100);
    const tier = toTitleCase(rank.tier);
    const standing = APEX_TIERS.includes(rank.tier) ? tier : `${tier} ${rank.division}`;

    return (
        <article className="flex flex-col gap-2 rounded-xl bg-surface p-4">
            <h3 className="font-display text-xs tracking-[1.4px] text-ink-muted uppercase">
                {t(`profile.ranks.queue.${rank.queue}`)}
            </h3>
            <p className="font-display text-xl font-semibold text-ink">{standing}</p>
            <p className="text-sm font-semibold text-gold">
                {t('profile.ranks.leaguePoints', { points: rank.leaguePoints })}
            </p>
            <p className="text-sm text-ink-muted">
                {t('profile.ranks.record', { wins: rank.wins, losses: rank.losses })} ·{' '}
                {t('profile.ranks.winRate', { rate: winRate })}
            </p>
        </article>
    );
}
