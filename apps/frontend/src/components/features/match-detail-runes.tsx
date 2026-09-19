import type { MatchParticipantRunes } from '@lynf/shared';
import { useTranslation } from 'react-i18next';

import { useRuneCatalogue } from '../../hooks/use-rune-catalogue';
import RuneIcon from '../ui/rune-icon';

const STYLE_ICON_SIZE = 24;
const KEYSTONE_ICON_SIZE = 32;
const MINOR_PERK_ICON_SIZE = 20;

type MatchDetailRunesProps = {
    runes: MatchParticipantRunes | null;
};

/**
 * The runes block: the primary tree with its keystone highlighted and its remaining
 * perks alongside, then the secondary tree with its two perks. Riot reports every
 * rune as a bare numeric id; turning one into a name and an icon needs Data Dragon's
 * rune catalogue, fetched once per version and shared the same way `useChampionCatalogue`
 * already shares the champion one — never redone per rune, never redone per match.
 *
 * A perk id the fetched catalogue does not carry degrades to a plain placeholder and a
 * `Rune {{id}}` label, the same graceful-degradation shape `ChampionPortrait` already
 * uses for an unknown champion.
 *
 * Stat shards are not shown: Data Dragon publishes no catalogue for them, unlike the
 * tree perks and styles above, so no id-to-icon mapping is guessed here.
 *
 * `runes === null` means this match was ingested before rune extraction shipped and,
 * since a finished match is never re-read from Riot, never will have one — said
 * plainly as a data gap, not shown as a silently empty block.
 */
export default function MatchDetailRunes({ runes }: Readonly<MatchDetailRunesProps>) {
    const { t } = useTranslation('summoner');
    const { data: catalogue, isPending, error } = useRuneCatalogue();

    const heading = (
        <h3 className="text-sm font-semibold text-ink">
            {t('profile.matches.detail.stuff.runes.heading')}
        </h3>
    );

    if (!runes) {
        return (
            <div className="flex flex-col gap-2">
                {heading}
                <p className="text-sm text-ink-muted">
                    {t('profile.matches.detail.stuff.runes.missing')}
                </p>
            </div>
        );
    }

    if (isPending || error || !catalogue) {
        return (
            <div className="flex flex-col gap-2">
                {heading}
                <p
                    className={`text-sm ${error ? 'text-loss' : 'text-ink-muted'}`}
                    role={error ? 'alert' : undefined}
                >
                    {error
                        ? t('profile.matches.detail.stuff.runes.unavailable')
                        : t('profile.matches.detail.stuff.runes.loading')}
                </p>
            </div>
        );
    }

    const perkName = (id: number) =>
        catalogue.perks.get(id)?.name ??
        t('profile.matches.detail.stuff.runes.unknownPerk', { id });

    const [keystoneId, ...minorPrimaryPerkIds] = runes.primaryPerks;

    return (
        <div className="flex flex-col gap-3">
            {heading}

            <div className="flex flex-wrap items-center gap-3">
                <RuneIcon entry={catalogue.styles.get(runes.primaryStyle)} size={STYLE_ICON_SIZE} />

                {keystoneId !== undefined && (
                    <RuneIcon
                        entry={catalogue.perks.get(keystoneId)}
                        size={KEYSTONE_ICON_SIZE}
                        label={perkName(keystoneId)}
                    />
                )}

                <ul className="flex items-center gap-1.5">
                    {minorPrimaryPerkIds.map((id) => (
                        <li key={id}>
                            <RuneIcon
                                entry={catalogue.perks.get(id)}
                                size={MINOR_PERK_ICON_SIZE}
                                label={perkName(id)}
                            />
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <RuneIcon entry={catalogue.styles.get(runes.subStyle)} size={STYLE_ICON_SIZE} />

                <ul className="flex items-center gap-1.5">
                    {runes.subPerks.map((id) => (
                        <li key={id}>
                            <RuneIcon
                                entry={catalogue.perks.get(id)}
                                size={MINOR_PERK_ICON_SIZE}
                                label={perkName(id)}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
