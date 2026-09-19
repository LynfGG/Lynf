import { DATA_DRAGON_BASE_URL } from '../../constants/data-dragon';
import type { ChampionCatalogue } from '../../api/champion-catalogue';

type ChampionPortraitProps = {
    championId: number;
    size: number;
    version: string | undefined;
    catalogue: ChampionCatalogue | undefined;
};

/**
 * A champion's square portrait from Data Dragon, at whatever size the caller needs —
 * the match list, the match detail teams, and the mastery band each show it at a
 * different size. Domain-agnostic: it knows nothing about matches or masteries, only
 * how to turn a champion id into an image.
 *
 * Degrades to a plain placeholder block, never a broken image, whenever the catalogue
 * has no entry for the id — a champion released after the fetched Data Dragon version —
 * or the version itself has not loaded yet.
 */
export default function ChampionPortrait({
    championId,
    size,
    version,
    catalogue,
}: Readonly<ChampionPortraitProps>) {
    const champion = catalogue?.get(championId);

    if (!champion || !version) {
        return (
            <div
                aria-hidden="true"
                className="shrink-0 rounded-md bg-surface-raised"
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <img
            src={`${DATA_DRAGON_BASE_URL}/cdn/${version}/img/champion/${champion.id}.png`}
            alt=""
            width={size}
            height={size}
            className="shrink-0 rounded-md object-cover"
        />
    );
}
