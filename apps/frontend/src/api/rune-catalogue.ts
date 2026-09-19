import { DATA_DRAGON_BASE_URL } from '../constants/data-dragon';
import { HttpError } from './http-error';

/**
 * One entry of Data Dragon's rune catalogue this app needs — a perk or a style share
 * the same shape, so one type serves both maps below.
 */
export type RuneCatalogueEntry = {
    id: number;
    name: string;
    /** Data Dragon's own relative path, e.g. `perk-images/Styles/Domination/Electrocute/Electrocute.png`. */
    icon: string;
};

type DataDragonRuneStyle = {
    id: number;
    name: string;
    icon: string;
    slots: { runes: { id: number; name: string; icon: string }[] }[];
};

/**
 * A rune catalogue, split the way `MatchParticipantRunes` needs it resolved: every
 * keystone and minor rune, keyed by its numeric perk id, and every style (Domination,
 * Precision, ...), keyed by its own numeric id. Riot never reuses an id across the two
 * ranges, so one map per kind is enough to resolve `primaryStyle`/`subStyle` with one
 * map and any perk id from `primaryPerks`/`subPerks` with the other.
 *
 * Stat shards (`statPerks`) are deliberately not part of this catalogue: unlike the
 * tree perks and styles below, Data Dragon publishes no JSON listing for them, and
 * guessing the id-to-icon mapping from memory was ruled out rather than risked — see
 * the report for task 23.
 */
export type RuneCatalogue = {
    perks: ReadonlyMap<number, RuneCatalogueEntry>;
    styles: ReadonlyMap<number, RuneCatalogueEntry>;
};

/**
 * Fetches Data Dragon's full rune list for one version, and re-keys it into the two
 * maps `RuneCatalogue` needs.
 */
export async function fetchRuneCatalogue(version: string): Promise<RuneCatalogue> {
    const response = await fetch(
        `${DATA_DRAGON_BASE_URL}/cdn/${version}/data/en_US/runesReforged.json`,
    );

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    const styles = (await response.json()) as DataDragonRuneStyle[];

    const styleEntries = new Map<number, RuneCatalogueEntry>();
    const perkEntries = new Map<number, RuneCatalogueEntry>();

    for (const style of styles) {
        styleEntries.set(style.id, { id: style.id, name: style.name, icon: style.icon });

        for (const slot of style.slots) {
            for (const rune of slot.runes) {
                perkEntries.set(rune.id, { id: rune.id, name: rune.name, icon: rune.icon });
            }
        }
    }

    return { perks: perkEntries, styles: styleEntries };
}
