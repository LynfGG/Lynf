import { HttpException, NotFoundException } from '@nestjs/common';

/**
 * Reads what is stored, refreshes it from Riot when it is not fresh enough, and falls
 * back on what is stored when Riot cannot answer.
 *
 * `TFallback` is whatever tells the caller a fallback exists and how fresh it is — a
 * row, a read date, anything — `undefined` meaning nothing was ever read. It is handed
 * back to `serveStored` and `logFallback` so neither needs to close over state the
 * caller already has.
 */
export type FreshnessFallback<TFallback, TResult> = {
    /** What already exists to fall back on, or `undefined` when nothing was ever read. */
    readonly fallback: TFallback | undefined;

    /** Whether `fallback` is fresh enough to serve without asking Riot at all. */
    isFresh(fallback: TFallback): boolean;

    /** Reads and converts what is stored. Called both when it is fresh and as a fallback. */
    serveStored(fallback: TFallback): Promise<TResult>;

    /** Asks Riot, persists the answer, and converts it. */
    refresh(): Promise<TResult>;

    /** Logs the fallback, as precisely as the caller wants: player, platform, error code. */
    logFallback(fallback: TFallback, error: HttpException): void;
};

/**
 * Riot is only asked when what is stored is not fresh enough, and a Riot failure only
 * ever falls back on what is already stored — never the other way around.
 */
export async function withFreshnessFallback<TFallback, TResult>(
    params: FreshnessFallback<TFallback, TResult>,
): Promise<TResult> {
    const { fallback } = params;

    if (fallback !== undefined && params.isFresh(fallback)) {
        return params.serveStored(fallback);
    }

    try {
        return await params.refresh();
    } catch (error) {
        // All three must hold before a Riot failure is hidden behind a stale answer:
        // - fallback === undefined: nothing was ever read, so there is no honest answer
        //   to fall back on — answering "unranked" to a Master player, or showing a
        //   profile that was never fetched, would be an outright lie, not a stale answer.
        // - !(error instanceof HttpException): a failure that is not Riot's — a database
        //   error, for instance — must never be hidden behind a stale answer.
        // - error instanceof NotFoundException: a 404 means the account is gone, not that
        //   the data is merely old; serving the stale answer would show a player who no
        //   longer exists.
        if (
            fallback === undefined ||
            !(error instanceof HttpException) ||
            error instanceof NotFoundException
        ) {
            throw error;
        }

        params.logFallback(fallback, error);
        return params.serveStored(fallback);
    }
}
