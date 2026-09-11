import { useTranslation } from 'react-i18next';

import { HttpError } from '../api/http-error';

/**
 * Turns a failed profile lookup into a sentence a player can act on.
 *
 * The back end already maps Riot's failures to HTTP statuses, so the front end
 * only has to name them.
 */
export function useSummonerErrorMessage() {
    const { t } = useTranslation('summoner');

    return (error: unknown) => {
        if (!(error instanceof HttpError)) {
            return t('errors.unknown');
        }

        switch (error.status) {
            case 400:
                return t('errors.invalidRiotId');
            case 404:
                return t('errors.notFound');
            case 429:
                return t('errors.rateLimited');
            case 502:
                return t('errors.keyRejected');
            case 503:
                return t('errors.riotUnavailable');
            default:
                return t('errors.unknown');
        }
    };
}
