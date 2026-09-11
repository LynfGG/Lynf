/** An error carrying the HTTP status, so callers can react to it rather than to a message. */
export class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}
