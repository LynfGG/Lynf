import { DATA_DRAGON_BASE_URL } from '../constants/data-dragon';
import { HttpError } from './http-error';

/** The one entry of Data Dragon's champion catalogue this app needs. */
export type ChampionCatalogueEntry = {
    /** The textual id Data Dragon names its images by, e.g. `MonkeyKing`. */
    id: string;
    /** The display name, e.g. `Wukong` — never translated, see the summoner locale files. */
    name: string;
};

type DataDragonChampionResponse = {
    data: Record<string, { key: string; id: string; name: string }>;
};

/**
 * A champion catalogue, keyed by Riot's numeric champion id — the id Riot's own APIs
 * report, not Data Dragon's textual one.
 */
export type ChampionCatalogue = ReadonlyMap<number, ChampionCatalogueEntry>;

/**
 * Fetches Data Dragon's full champion list for one version, and re-keys it by numeric
 * champion id.
 *
 * Data Dragon indexes its own catalogue by the textual id (`Ahri`, `MonkeyKing`), and
 * carries the numeric id only as `key`, a string. Every Riot API that reports a
 * champion — `champion-mastery-v4` among them — reports the numeric one, so re-keying
 * here is what lets a lookup by `championId` be a single map access everywhere else.
 */
export async function fetchChampionCatalogue(version: string): Promise<ChampionCatalogue> {
    const response = await fetch(`${DATA_DRAGON_BASE_URL}/cdn/${version}/data/en_US/champion.json`);

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    const { data } = (await response.json()) as DataDragonChampionResponse;

    return new Map(
        Object.values(data).map((champion) => [
            Number(champion.key),
            { id: champion.id, name: champion.name },
        ]),
    );
}
