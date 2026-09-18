import { EPlatformRegion, PLATFORM_REGIONS, RIOT_ID_LENGTH, type RiotIdLookup } from '@lynf/shared';
import type { SubmitEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import Button from '../components/ui/button';
import Field from '../components/ui/field';
import Select from '../components/ui/select';
import { REGION_LABELS } from '../constants/regions';

const REGION_OPTIONS = PLATFORM_REGIONS.map((region) => ({
    value: region,
    label: REGION_LABELS[region],
}));

export default function HomePage() {
    const { t } = useTranslation('summoner');
    const navigate = useNavigate();

    const [form, setForm] = useState<RiotIdLookup>({
        region: EPlatformRegion.EUW,
        gameName: '',
        tagLine: '',
    });

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

        // Each part is encoded on its own before joining, so a `#` (or a literal `-`
        // introduced by encoding) pasted into either field cannot be mistaken for the
        // separator or open a URL fragment — the same discipline as the API client.
        const riotId = `${encodeURIComponent(search.gameName)}-${encodeURIComponent(search.tagLine)}`;

        navigate(`/${search.region}/${riotId}`);
    };

    return (
        <section className="flex flex-col gap-6">
            <h2 className="text-xl font-semibold text-ink">{t('search.title')}</h2>

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
        </section>
    );
}
