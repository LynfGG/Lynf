import { EPlatformRegion, PLATFORM_REGIONS, RIOT_ID_LENGTH, type RiotIdLookup } from '@lynf/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import ChampionMasteryBand from '../../components/features/champion-mastery-band';
import MatchList from '../../components/features/match-list';
import SummonerHero from '../../components/features/summoner-hero';
import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import { useSummonerMasteries } from '../../hooks/use-summoner-masteries';
import { useSummonerMatches } from '../../hooks/use-summoner-matches';
import { useSummonerProfile } from '../../hooks/use-summoner-profile';
import { useSummonerRanks } from '../../hooks/use-summoner-ranks';
import { addRecentSearch } from '../../utils/recent-searches';

/**
 * A Riot ID travels in the URL as `gameName-tagLine`: that is how players copy it, and
 * `#` cannot cross a URL — it would open a fragment. Only the last dash separates the
 * two, because a game name may contain dashes and a tag line may not.
 */
function parseLookup(
    region: string | undefined,
    riotId: string | undefined,
): RiotIdLookup | undefined {
    if (!region || !riotId) {
        return undefined;
    }

    if (!(PLATFORM_REGIONS as readonly string[]).includes(region)) {
        return undefined;
    }

    // `#` is the real separator of a Riot ID and can never appear in the ID itself, so a
    // decoded `#` indicates the URL was built from an unencoded Riot ID (or tampered
    // with) rather than from a properly encoded game name and tag line.
    if (riotId.includes('#')) {
        return undefined;
    }

    const separator = riotId.lastIndexOf('-');

    if (separator <= 0 || separator === riotId.length - 1) {
        return undefined;
    }

    const gameName = riotId.slice(0, separator);
    const tagLine = riotId.slice(separator + 1);

    if (
        gameName.length < RIOT_ID_LENGTH.gameName.min ||
        gameName.length > RIOT_ID_LENGTH.gameName.max ||
        tagLine.length < RIOT_ID_LENGTH.tagLine.min ||
        tagLine.length > RIOT_ID_LENGTH.tagLine.max
    ) {
        return undefined;
    }

    return {
        region: region as EPlatformRegion,
        gameName,
        tagLine,
    };
}

export default function SummonerPage() {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { region, riotId } = useParams();

    const lookup = parseLookup(region, riotId);
    const {
        data,
        isPending,
        isFetching,
        error,
        refetch: refetchProfile,
    } = useSummonerProfile(lookup);
    const {
        data: ranks,
        isPending: isRanksPending,
        isFetching: isRanksFetching,
        error: ranksError,
        refetch: refetchRanks,
    } = useSummonerRanks(lookup);
    const {
        data: masteries,
        isPending: isMasteriesPending,
        isFetching: isMasteriesFetching,
        error: masteriesError,
        refetch: refetchMasteries,
    } = useSummonerMasteries(lookup);
    const {
        data: matches,
        isPending: isMatchesPending,
        isFetching: isMatchesFetching,
        error: matchesError,
        refetch: refetchMatches,
    } = useSummonerMatches(lookup);

    // Recorded here, once the profile has actually rendered, and never on form submit:
    // a Riot ID that does not exist has nothing to do in a visitor's recent searches.
    useEffect(() => {
        if (!data) {
            return;
        }

        addRecentSearch({
            region: data.region,
            gameName: data.gameName,
            tagLine: data.tagLine,
        });
    }, [data]);

    if (!lookup) {
        return (
            <p role="alert" className="text-sm text-loss">
                {t('errors.invalidRiotId')}
            </p>
        );
    }

    const handleRefresh = () => {
        void refetchProfile();
        void refetchRanks();
        void refetchMasteries();
        void refetchMatches();
    };

    return (
        <section className="flex flex-col gap-6">
            {isPending && <p className="text-sm text-ink-muted">{t('profile.loading')}</p>}

            {error && !isPending && (
                <p role="alert" className="text-sm text-loss">
                    {messageFor(error)}
                </p>
            )}

            {data && (
                <>
                    <SummonerHero
                        profile={data}
                        ranks={ranks}
                        isRanksPending={isRanksPending}
                        ranksError={ranksError}
                        onRefresh={handleRefresh}
                        isRefreshing={
                            isFetching ||
                            isRanksFetching ||
                            isMasteriesFetching ||
                            isMatchesFetching
                        }
                    />

                    <ChampionMasteryBand
                        masteries={masteries}
                        isPending={isMasteriesPending}
                        error={masteriesError}
                    />

                    <MatchList
                        matches={matches}
                        isPending={isMatchesPending}
                        error={matchesError}
                        viewedPuuid={data.puuid}
                    />
                </>
            )}
        </section>
    );
}
