import type { RuneCatalogueEntry } from '../../api/rune-catalogue';
import { DATA_DRAGON_BASE_URL } from '../../constants/data-dragon';

type RuneIconProps = {
    entry: RuneCatalogueEntry | undefined;
    size: number;
    /** Falls back to the entry's own name when omitted. */
    label?: string;
};

/**
 * One rune, or rune-tree, icon from Data Dragon, at whatever size the caller needs.
 * Domain-agnostic, the same split already made for `ChampionPortrait`: it knows nothing
 * about matches or runes as a domain, only how to turn a catalogue entry into an image.
 *
 * Degrades to a plain placeholder circle, never a broken image, whenever the catalogue
 * has no entry for the id — a rune the fetched Data Dragon version does not carry, an id
 * the catalogue could not resolve, or the catalogue itself not having loaded yet.
 */
export default function RuneIcon({ entry, size, label }: Readonly<RuneIconProps>) {
    if (!entry) {
        return (
            <div
                aria-hidden="true"
                className="shrink-0 rounded-full bg-surface-raised"
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <img
            src={`${DATA_DRAGON_BASE_URL}/cdn/img/${entry.icon}`}
            alt={label ?? entry.name}
            width={size}
            height={size}
            className="shrink-0 rounded-full object-cover"
        />
    );
}
