/**
 * HTTP errors: the shape `ctx.throw()` and `allowedMethods()` raise.
 *
 * Koa gets these from `http-errors`; the router this was extracted from bundled a
 * copy of it. Only the part a router actually needs is here — a status, a
 * message, and the `expose` flag that says whether the message may be shown to
 * the caller — so the package keeps its runtime dependency budget.
 *
 * @module sac-path-router/core/errors
 */
/** An error carrying an HTTP status. */
export declare class HttpError extends Error {
    /** Status code this error answers with. */
    readonly status: number;
    /**
     * Whether `message` is safe to show the caller.
     *
     * 4xx are the caller's fault and their messages are meant to be read; 5xx are
     * ours and stay out of the response body.
     */
    readonly expose: boolean;
    /**
     * @param status - HTTP status code.
     * @param message - error message; defaults to the status text.
     * @param options - `expose` override, plus an optional cause.
     */
    constructor(status: number, message?: string, options?: {
        expose?: boolean;
        cause?: unknown;
    });
}
/** 501, as `allowedMethods()` raises it. */
export declare function notImplemented(message?: string): HttpError;
/** 405, as `allowedMethods()` raises it. */
export declare function methodNotAllowed(message?: string): HttpError;
/**
 * Build an error the way Koa's `ctx.throw` accepts one.
 *
 * Accepts `(status)`, `(status, message)`, `(status, Error)`, `(message)`, or an
 * `Error` — the argument shapes http-errors supports and callers rely on.
 *
 * @param args - status, message, or an existing error.
 * @returns the error to throw.
 */
export declare function createError(...args: unknown[]): HttpError;
//# sourceMappingURL=errors.d.ts.map