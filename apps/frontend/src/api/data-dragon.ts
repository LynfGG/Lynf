import { DATA_DRAGON_BASE_URL } from '../constants/data-dragon';
import { HttpError } from './http-error';

/**
 * The newest Data Dragon version. Assets are published per version, so an icon added in
 * a recent patch does not exist under an older one.
 */
export async function fetchLatestDataDragonVersion(): Promise<string> {
    const response = await fetch(`${DATA_DRAGON_BASE_URL}/api/versions.json`);

    if (!response.ok) {
        throw new HttpError(response.status, `Request failed with status ${response.status}`);
    }

    // Riot lists versions newest first.
    const [latest] = (await response.json()) as string[];

    return latest;
}
