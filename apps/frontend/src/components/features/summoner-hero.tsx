import type { SummonerProfile, SummonerRank } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { DATA_DRAGON_BASE_URL } from '../../constants/data-dragon';
import { REGION_LABELS } from '../../constants/regions';
import { useDataDragonVersion } from '../../hooks/use-data-dragon-version';
import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import RankPill from './rank-pill';

type SummonerHeroProps = {
    profile: SummonerProfile;
    ranks: SummonerRank[] | undefined;
    isRanksPending: boolean;
    ranksError: Error | null;
    onRefresh: () => void;
    isRefreshing: boolean;
};

const AVATAR_SIZE = 104;

/**
 * The identity banner: avatar, name, ranked pills and the refresh button, all in one row
 * on the mockup. It replaces the old `SummonerCard` + `RANKED` section pair — the ranks
 * live next to the name now, not in a section of their own underneath.
 */
export default function SummonerHero({
    profile,
    ranks,
    isRanksPending,
    ranksError,
    onRefresh,
    isRefreshing,
}: Readonly<SummonerHeroProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { data: version } = useDataDragonVersion();

    return (
        <article className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
            <div className="flex min-w-0 items-center gap-4 sm:flex-1 sm:gap-6">
                <div className="relative size-26 shrink-0">
                    {version ? (
                        <img
                            src={`${DATA_DRAGON_BASE_URL}/cdn/${version}/img/profileicon/${profile.profileIconId}.png`}
                            alt=""
                            width={AVATAR_SIZE}
                            height={AVATAR_SIZE}
                            className="size-full rounded-full object-cover"
                        />
                    ) : (
                        <div
                            aria-hidden="true"
                            className="size-full rounded-full bg-surface-raised"
                        />
                    )}
                    <span className="absolute -bottom-2.5 left-1/2 h-6 -translate-x-1/2 rounded-full bg-gold px-2 text-xs leading-6 font-bold whitespace-nowrap text-ground">
                        {t('profile.level', { level: profile.summonerLevel })}
                    </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
                    <h1 className="truncate font-display text-2xl font-bold tracking-tight text-ink sm:text-[40px]">
                        {profile.gameName}
                        <span className="ml-1 text-base font-normal text-ink-muted sm:text-2xl">
                            #{profile.tagLine}
                        </span>
                    </h1>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {isRanksPending && (
                            <p className="text-sm text-ink-muted">{t('profile.ranks.loading')}</p>
                        )}

                        {ranksError && !isRanksPending && (
                            <p role="alert" className="text-sm text-loss">
                                {messageFor(ranksError)}
                            </p>
                        )}

                        {ranks && ranks.length === 0 && (
                            <span className="inline-flex h-8 items-center rounded-full bg-surface-raised px-3 text-sm font-semibold text-ink-muted">
                                {t('profile.ranks.unranked')}
                            </span>
                        )}

                        {ranks?.map((rank) => (
                            <RankPill key={rank.queue} rank={rank} />
                        ))}

                        <span className="text-[13px] text-ink-muted">
                            {REGION_LABELS[profile.region]}
                            <span aria-hidden="true"> · </span>
                            {t('profile.updatedAt', {
                                when: new Date(profile.updatedAt),
                                formatParams: { when: { dateStyle: 'medium', timeStyle: 'short' } },
                            })}
                        </span>
                    </div>
                </div>
            </div>

            {/*
                Each of the four refetches this triggers re-checks its own freshness
                window on the server, so a click seconds after the page loaded can
                legitimately produce no Riot call and no changed data — the four TTLs
                exist to protect a rate-limited key and are never bypassed here. What the
                click always does, though, is round-trip to our own API, so `isRefreshing`
                (`isFetching` on all four queries) is honest, real activity: the spinner
                and label swap are what tell a player the click registered, even when the
                answer comes back unchanged.
            */}
            <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-busy={isRefreshing}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-gold px-5 text-sm font-bold text-ground transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-ink-muted sm:w-auto"
            >
                {isRefreshing && (
                    <span
                        aria-hidden="true"
                        className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
                    />
                )}
                {t(isRefreshing ? 'profile.refreshing' : 'profile.refresh')}
            </button>
        </article>
    );
}
