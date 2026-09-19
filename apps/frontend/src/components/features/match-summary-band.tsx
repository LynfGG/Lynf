import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChampionCatalogue } from '../../api/champion-catalogue';
import type { MatchesSummary } from '../../utils/match-summary';
import ChampionPortrait from '../ui/champion-portrait';

const TOP_CHAMPION_PORTRAIT_SIZE = 28;

type MatchSummaryBandProps = {
    summary: MatchesSummary;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
};

function StatTile({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                {label}
            </span>
            {children}
        </div>
    );
}

/**
 * The row of numbers next to the queue filters, recomputed from whatever slice of
 * matches is currently on screen so it always agrees with the list right below it.
 *
 * "Lane duels won" leads, in gold and the display font: it is the product's identity
 * statistic, the one no competitor shows, and the mockup asks for it to be the most
 * visible figure in the row. It is entirely absent — not "0 / 0" — whenever none of the
 * shown matches had an identifiable opponent to duel.
 */
export default function MatchSummaryBand({
    summary,
    version,
    catalogue,
}: Readonly<MatchSummaryBandProps>) {
    const { t } = useTranslation('summoner');

    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {summary.laneDuels && (
                <StatTile label={t('profile.matches.summary.laneDuels.label')}>
                    <span className="font-display text-2xl leading-none font-bold text-gold">
                        {t('profile.matches.summary.laneDuels.value', {
                            won: summary.laneDuels.won,
                            eligible: summary.laneDuels.eligible,
                        })}
                    </span>
                </StatTile>
            )}

            <StatTile label={t('profile.matches.summary.record.label')}>
                <span className="text-sm font-semibold text-ink">
                    {t('profile.matches.summary.record.value', {
                        wins: summary.wins,
                        losses: summary.losses,
                    })}
                </span>
            </StatTile>

            <StatTile label={t('profile.matches.summary.kda.label')}>
                <span className="text-sm font-semibold text-ink">
                    {t('profile.matches.summary.kda.value', {
                        kills: summary.averageKda.kills,
                        deaths: summary.averageKda.deaths,
                        assists: summary.averageKda.assists,
                    })}
                </span>
            </StatTile>

            {summary.topChampions.length > 0 && (
                <StatTile label={t('profile.matches.summary.topChampions.label')}>
                    <ul className="flex items-center gap-2">
                        {summary.topChampions.map(({ championId, games }) => (
                            <li key={championId} className="flex items-center gap-1.5">
                                <ChampionPortrait
                                    championId={championId}
                                    size={TOP_CHAMPION_PORTRAIT_SIZE}
                                    version={version}
                                    catalogue={catalogue}
                                />
                                <span className="text-[11px] text-ink-muted">
                                    {t('profile.matches.summary.topChampions.games', {
                                        count: games,
                                    })}
                                </span>
                            </li>
                        ))}
                    </ul>
                </StatTile>
            )}
        </div>
    );
}
