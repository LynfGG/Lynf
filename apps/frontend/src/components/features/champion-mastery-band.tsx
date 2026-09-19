import type { ChampionMastery } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { useChampionCatalogue } from '../../hooks/use-champion-catalogue';
import { useDataDragonVersion } from '../../hooks/use-data-dragon-version';
import { useSummonerErrorMessage } from '../../hooks/use-summoner-error-message';
import ChampionPortrait from '../ui/champion-portrait';

type ChampionMasteryBandProps = {
    masteries: ChampionMastery[] | undefined;
    isPending: boolean;
    error: Error | null;
};

const PORTRAIT_SIZE = 40;

/**
 * The three champions a player has mastered the most, in a discreet strip below the
 * identity banner. The "Duel" mockup does not plan for it — matches will always be the
 * main event — so it borrows the same tokens and density as the rest of the page rather
 * than drawing its own attention.
 *
 * A champion missing from Data Dragon's catalogue — one released after the fetched
 * version — degrades to a placeholder portrait and its raw numeric id, rather than a
 * broken image or an empty name.
 */
export default function ChampionMasteryBand({
    masteries,
    isPending,
    error,
}: Readonly<ChampionMasteryBandProps>) {
    const { t } = useTranslation('summoner');
    const messageFor = useSummonerErrorMessage();
    const { data: version } = useDataDragonVersion();
    const { data: catalogue } = useChampionCatalogue();

    if (isPending) {
        return <p className="text-sm text-ink-muted">{t('profile.masteries.loading')}</p>;
    }

    if (error) {
        return (
            <p role="alert" className="text-sm text-loss">
                {messageFor(error)}
            </p>
        );
    }

    if (!masteries || masteries.length === 0) {
        return <p className="text-sm text-ink-muted">{t('profile.masteries.empty')}</p>;
    }

    return (
        <ul className="flex flex-wrap gap-3">
            {masteries.map((mastery) => {
                const champion = catalogue?.get(mastery.championId);

                return (
                    <li
                        key={mastery.championId}
                        className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2"
                    >
                        <ChampionPortrait
                            championId={mastery.championId}
                            size={PORTRAIT_SIZE}
                            version={version}
                            catalogue={catalogue}
                        />

                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-ink">
                                {champion?.name ??
                                    t('profile.masteries.unknownChampion', {
                                        id: mastery.championId,
                                    })}
                            </span>
                            <span className="text-xs text-ink-muted">
                                {t('profile.masteries.level', { level: mastery.championLevel })}
                                {' · '}
                                {t('profile.masteries.points', { points: mastery.championPoints })}
                            </span>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
