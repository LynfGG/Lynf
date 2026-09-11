import type { SummonerProfile } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { DATA_DRAGON_BASE_URL } from '../../constants/data-dragon';
import { REGION_LABELS } from '../../constants/regions';
import { useDataDragonVersion } from '../../hooks/use-data-dragon-version';

type SummonerCardProps = {
    profile: SummonerProfile;
};

const ICON_SIZE = 72;

export default function SummonerCard({ profile }: Readonly<SummonerCardProps>) {
    const { t } = useTranslation('summoner');
    const { data: version } = useDataDragonVersion();

    return (
        <article className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            {version ? (
                <img
                    src={`${DATA_DRAGON_BASE_URL}/cdn/${version}/img/profileicon/${profile.profileIconId}.png`}
                    alt=""
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    className="rounded-lg"
                />
            ) : (
                <div aria-hidden="true" className="size-18 shrink-0 rounded-lg bg-slate-800" />
            )}
            <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-100">
                    {profile.gameName}
                    <span className="text-slate-500">#{profile.tagLine}</span>
                </h2>
                <p className="text-sm text-slate-400">
                    {t('profile.level', { level: profile.summonerLevel })} ·{' '}
                    {REGION_LABELS[profile.region]}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    {t('profile.updatedAt', {
                        when: new Date(profile.updatedAt),
                        formatParams: { when: { dateStyle: 'medium', timeStyle: 'short' } },
                    })}
                </p>
            </div>
        </article>
    );
}
