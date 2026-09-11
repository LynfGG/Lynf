import { EPlatformRegion, PLATFORM_REGIONS, RIOT_ID_LENGTH, type RiotIdLookup } from '@lynf/shared';
import { hashKey } from '@tanstack/react-query';
import type { SubmitEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import SummonerCard from '../components/features/summoner-card';
import Button from '../components/ui/button';
import Field from '../components/ui/field';
import Select from '../components/ui/select';
import { REGION_LABELS } from '../constants/regions';
import { useSummonerErrorMessage } from '../hooks/use-summoner-error-message';
import { summonerProfileQueryKey, useSummonerProfile } from '../hooks/use-summoner-profile';

const REGION_OPTIONS = PLATFORM_REGIONS.map((region) => ({
    value: region,
    label: REGION_LABELS[region],
}));

export default function HomePage() {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();

    const [form, setForm] = useState<RiotIdLookup>({
        region: EPlatformRegion.EUW,
        gameName: '',
        tagLine: '',
    });
    const [submitted, setSubmitted] = useState<RiotIdLookup | undefined>();

    const { data, isFetching, error, refetch } = useSummonerProfile(submitted);

    const search = {
        region: form.region,
        gameName: form.gameName.trim(),
        tagLine: form.tagLine.trim(),
    };
    const canSubmit =
        search.gameName.length >= RIOT_ID_LENGTH.gameName.min &&
        search.tagLine.length >= RIOT_ID_LENGTH.tagLine.min;

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Searching the same player again changes no query key, so TanStack Query would do
        // nothing — after a failure, the button would look dead. Ask for the request instead.
        const isSameSearch =
            submitted !== undefined &&
            hashKey(summonerProfileQueryKey(submitted)) ===
                hashKey(summonerProfileQueryKey(search));

        if (isSameSearch) {
            void refetch();
            return;
        }

        setSubmitted(search);
    };

    return (
        <section className="flex flex-col gap-6">
            <h2 className="text-xl font-semibold text-slate-100">{t('search.title')}</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <Field
                        label={t('search.gameNameLabel')}
                        placeholder={t('search.gameNamePlaceholder')}
                        maxLength={RIOT_ID_LENGTH.gameName.max}
                        value={form.gameName}
                        onChange={(event) =>
                            setForm((previous) => ({ ...previous, gameName: event.target.value }))
                        }
                    />
                </div>
                <div className="w-full sm:w-24">
                    <Field
                        label={t('search.tagLineLabel')}
                        placeholder={t('search.tagLinePlaceholder')}
                        maxLength={RIOT_ID_LENGTH.tagLine.max}
                        value={form.tagLine}
                        onChange={(event) =>
                            setForm((previous) => ({ ...previous, tagLine: event.target.value }))
                        }
                    />
                </div>
                <div className="w-full sm:w-32">
                    <Select
                        label={t('search.regionLabel')}
                        options={REGION_OPTIONS}
                        value={form.region}
                        onChange={(event) =>
                            setForm((previous) => ({
                                ...previous,
                                region: event.target.value as EPlatformRegion,
                            }))
                        }
                    />
                </div>
                <Button type="submit" disabled={!canSubmit}>
                    {t('search.submit')}
                </Button>
            </form>

            {isFetching && <p className="text-sm text-slate-400">{t('profile.loading')}</p>}

            {error && !isFetching && (
                <p role="alert" className="text-sm text-rose-400">
                    {messageFor(error)}
                </p>
            )}

            {data && !isFetching && <SummonerCard profile={data} />}
        </section>
    );
}
