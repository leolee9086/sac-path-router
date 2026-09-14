/**
 * The Express dialect's response builder: collects status and headers, then
 * materializes one web `Response` on the routing context.
 *
 * Method semantics follow Express's `res` (MIT, Copyright (c) 2009-2014 TJ
 * Holowaychuk, 2013-2014 Roman Shtylman, 2014-2015 Douglas Christopher Wilson);
 * see THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/express/response
 */
import { RouterContext } from '../core/context.js';
import type { CookieOptions, ExpressResponse } from './types.js';
export type { CookieOptions } from './types.js';
/**
 * Express-shaped response writer over a routing context.
 *
 * Finishing (`json`, `send`, `end`, `redirect`, `sendStatus`) marks the routing
 * context as responded, which is what stops the fetch entry from reaching the
 * network.
 */
export declare class ResponseBuilder implements ExpressResponse {
    private readonly context;
    /** Status a response uses; defaults to 200. */
    statusCode: number;
    /** Whether a response was produced. */
    headersSent: boolean;
    /** Per-response scratch space, as in Express. */
    locals: Record<string, unknown>;
    /**
     * @param context - routing context this response writes into.
     */
    constructor(context: RouterContext);
    /** Set the status code. */
    status(code: number): this;
    /** Set one response header. */
    set(field: string, value: string): this;
    /** Alias of {@link set}. */
    header(field: string, value: string): this;
    /** Add one value to a response header. */
    append(field: string, value: string): this;
    /** Set the `Content-Type` header. */
    type(value: string): this;
    /** Read one response header that was set. */
    get(field: string): string | null;
    /** Send a JSON body. */
    json(body: unknown): this;
    /** Send a body: a string, bytes, JSON value, or nothing. */
    send(body?: unknown): this;
    /** Finish the response. */
    end(body?: unknown): this;
    /** Redirect to `url`. */
    redirect(url: string, code?: number): this;
    /** Finish the response with a status and no body. */
    sendStatus(code: number): this;
    /**
     * Set one cookie.
     *
     * Serialized here rather than delegated, so a local route needs no Node
     * builtin. `SameSite=None` implies `Secure`, as browsers require.
     *
     * @param name - cookie name.
     * @param value - cookie value.
     * @param options - cookie attributes.
     */
    cookie(name: string, value: string, options?: CookieOptions): this;
    /** Expire one cookie. */
    clearCookie(name: string, options?: CookieOptions): this;
    /** Vary the response on one request header. */
    vary(field: string): this;
    /** Add `Link` headers for one resource map. */
    links(links: Record<string, string>): this;
    /**
     * Answer with the first representation the request accepts.
     *
     * @param types - media type to handler, plus an optional `default`.
     */
    format(types: Record<string, () => unknown>): this;
}
//# sourceMappingURL=response.d.ts.map