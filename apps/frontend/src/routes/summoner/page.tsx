import { EPlatformRegion, PLATFORM_REGIONS, RIOT_ID_LENGTH, type RiotIdLookup } from '@lynf/shared';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import SummonerCard from '../../components/features/summoner-card';
import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import { useSummonerProfile } from '../../hooks/use-summoner-profile';

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

    const separator = riotId.lastIndexOf('-');

    if (separator <= 0 || separator === riotId.length - 1) {
        return undefined;
    }

    const gameName = riotId.slice(0, separator);
    const tagLine = riotId.slice(separator + 1);

    // `#` is the real separator of a Riot ID and can never be part of a game name, so a
    // decoded `#` here means the URL was built from an unencoded Riot ID (or tampered
    // with) rather than a game name that happens to contain dashes.
    if (gameName.includes('#')) {
        return undefined;
    }

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
    const { data, isFetching, error } = useSummonerProfile(lookup);

    if (!lookup) {
        return (
            <p role="alert" className="text-sm text-loss">
                {t('errors.invalidRiotId')}
            </p>
        );
    }

    return (
        <section className="flex flex-col gap-6">
            {isFetching && <p className="text-sm text-ink-muted">{t('profile.loading')}</p>}

            {error && !isFetching && (
                <p role="alert" className="text-sm text-loss">
                    {messageFor(error)}
                </p>
            )}

            {data && !isFetching && <SummonerCard profile={data} />}
        </section>
    );
}
