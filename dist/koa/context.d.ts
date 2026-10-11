/**
 * Koa dialect: the context shape middleware written for Koa expects.
 *
 * The reference router this was extracted from shipped a full Koa context,
 * request, and response. A router in front of `fetch` needs all of it, because
 * middleware in the wild reaches for `ctx.throw`, `ctx.accepts`, `ctx.redirect`,
 * `ctx.attachment` and the rest — the auth middleware in that very codebase
 * calls `ctx.throw(401, ...)`.
 *
 * Two names had to move, because this router's `ctx` is a **fetch** context
 * first:
 *
 * | Koa | here |
 * |---|---|
 * | `ctx.set/get` (response headers) | `ctx.set/get` — kept as Koa means them |
 * | (outgoing request headers) | `ctx.setRequestHeader` / `ctx.getRequestHeader` |
 * | `ctx.request` (a Koa request) | `ctx.request` is the web `Request`; the Koa
 *   accessors live directly on the context, which is what Koa's own delegation
 *   does anyway |
 * | `ctx.request.body` | `ctx.requestBody` (the outgoing body) |
 *
 * @module sac-path-router/koa/context
 */
import { RouterContext } from '../core/context.js';
/**
 * A Koa-shaped context over the core one.
 *
 * Everything Koa delegates from `ctx` to `ctx.request` / `ctx.response` is
 * defined here directly, since the core keeps those two as web-standard objects.
 */
export declare class KoaContext extends RouterContext {
    /** Guards `assert` and the response setters. */
    private explicitStatus;
    /** Response status text, when it was set explicitly. */
    private statusMessage;
    /**
     * Throw when `test` is falsy, the way Koa's `ctx.assert` does.
     *
     * @param test - value to test.
     * @param status - status for the thrown error.
     * @param message - message for the thrown error.
     */
    assert(test: unknown, status?: number, message?: string): asserts test;
    /**
     * Throw an HTTP error. Accepts the same argument shapes as http-errors:
     * `(403)`, `(400, 'bad')`, `(400, new Error('bad'))`, `('bad')`, `(error)`.
     */
    throw(...args: unknown[]): never;
    /**
     * Default error handling: report, then answer with the error's status.
     *
     * 5xx messages are not echoed back unless the error says they may be.
     */
    onerror(error: unknown): void;
    /**
     * The application this context belongs to, when one was given.
     *
     * Set by `Application.fetch()`. `onerror` emits through it, and middleware can
     * read `ctx.app.env` and friends.
     */
    app: {
        emit(event: string, ...args: unknown[]): void;
    } | undefined;
    /**
     * Set the response status, remembering that it was chosen explicitly.
     *
     * Validation lives in the core context's `status` accessor, so this only adds
     * the bookkeeping Koa needs: a route that set a status but no body should not
     * have that status overwritten by the body-defaulting rule.
     */
    setStatus(code: number): void;
    /** Whether the status was set explicitly rather than inferred from a body. */
    get hasExplicitStatus(): boolean;
    /**
     * Set a response header; an object sets several at once.
     *
     * This is Koa's meaning. The core's `set` writes an **outgoing request**
     * header, which is this router's own concern; that is now `setRequestHeader`.
     */
    set(field: string | Record<string, string>, value?: string): void;
    /** One response header, or '' when it is not set. */
    get(field: string): string;
    /** Whether a response header is set. */
    has(field: string): boolean;
    /** Append to a response header, keeping what is there. */
    append(field: string, value: string | string[]): void;
    /** Remove a response header. */
    remove(field: string): void;
    /** Set an **outgoing request** header (this router's own addition). */
    setRequestHeader(field: string, value: string): void;
    /** One **outgoing request** header, or null. */
    getRequestHeader(field: string): string | null;
    /** Response `Content-Type` without parameters. */
    get type(): string;
    /** Set `Content-Type`. */
    set type(value: string);
    /** Response `ETag`, normalizing the quotes. */
    get etag(): string;
    /** Set `ETag`, adding quotes when they are missing. */
    set etag(value: string);
    /** Response `Last-Modified` as a Date, when present. */
    get lastModified(): Date | undefined;
    /** Set `Last-Modified` from a Date or a parseable string. */
    set lastModified(value: Date | string);
    /** Whether a body has been written to a response that is already closed. */
    get headerSent(): boolean;
    /**
     * Redirect to `url`, the way Koa's `ctx.redirect` does.
     *
     * `'back'` follows the Referer (or `alt`), the body is negotiated between HTML
     * and text, and the status defaults to 302 when the current one is not already
     * a redirect.
     */
    redirect(url: string, alt?: string): void;
    /** Set `Content-Disposition: attachment`, optionally with a filename. */
    attachment(filename?: string): void;
    /** Vary on `field`, appending to any existing `Vary`. */
    vary(field: string): void;
    /** Raw query string, without the leading `?`. */
    get querystring(): string;
    /** Set the query string (no leading `?` needed). */
    set querystring(value: string);
    /** Query string with the leading `?`, or '' when there is none. */
    get search(): string;
    /** Set the search string; a leading `?` is optional. */
    set search(value: string);
    /** `scheme://host` of the current target. */
    get origin(): string;
    /** Full request URL as a string. */
    get href(): string;
    /** The target as a WHATWG `URL`. */
    get URL(): URL;
    /** Host without the port. */
    get hostname(): string;
    /**
     * Labels before the app's own domain, reversed as Koa returns them.
     *
     * `tobi.ferrets.example.com` with the default offset of 2 gives
     * `['ferrets', 'tobi']`. An IP host has no subdomains.
     */
    get subdomains(): string[];
    /** Application settings this context was given, when any. */
    appOptions: {
        proxy?: boolean;
        subdomainOffset?: number;
        proxyIpHeader?: string;
        maxIpsCount?: number;
    } | undefined;
    /**
     * Forwarded client addresses, nearest first, when the app trusts a proxy.
     *
     * @returns the addresses, capped by `maxIpsCount` when one is set.
     */
    get ips(): string[];
    /** Client address: the first forwarded one, or the host's own. */
    get ip(): string;
    /** `https` when the target says so, honoring `X-Forwarded-Proto` behind a proxy. */
    get protocol(): string;
    /** Whether the request arrived over TLS. */
    get secure(): boolean;
    /** Whether the request is idempotent by method. */
    get idempotent(): boolean;
    /** Charset named by the request `Content-Type`, or ''. */
    get charset(): string;
    /** Declared request body length, or undefined. */
    get requestLength(): number | undefined;
    /** Request `Content-Type` without parameters. */
    get requestType(): string;
    /**
     * Whether a conditional request may be answered with 304.
     *
     * True when the method is GET or HEAD, the status is 2xx or 304, and the
     * request's `If-None-Match` / `If-Modified-Since` still match the response's
     * `ETag` / `Last-Modified`.
     */
    get fresh(): boolean;
    /** Whether a conditional request must be answered in full. */
    get stale(): boolean;
    /** Response status message, when one was set. */
    get message(): string;
    /** Set the response status message. */
    set message(value: string);
    /** Response body length in bytes, derived from the body when not set. */
    get length(): number | undefined;
    /** Set `Content-Length`. */
    set length(value: number);
    /** Whether the response can still be written to. */
    get writable(): boolean;
    /** Present for Koa parity; this router has no socket to flush. */
    flushHeaders(): void;
    /** Backing field of {@link cookies}. */
    private cookieJar;
    /**
     * Request cookies, readable and settable.
     *
     * Reading parses the request's `Cookie` header; assigning a name queues a
     * `Set-Cookie` on the response. Deliberately minimal — no signing, no
     * encryption — because a router should not silently decide a security policy.
     */
    get cookies(): CookieJar;
    /** Request `Accept` header, for the content-negotiation helpers below. */
    private acceptHeader;
    /**
     * Best match among `types` against the request's `Accept`.
     *
     * @returns the matching type, an array of matches when given an array, or false.
     */
    accepts(...types: (string | string[])[]): string | string[] | false;
    /** Best match among `charsets` against `Accept-Charset`. */
    acceptsCharsets(...charsets: (string | string[])[]): string | string[] | false;
    /** Best match among `encodings` against `Accept-Encoding`. */
    acceptsEncodings(...encodings: (string | string[])[]): string | string[] | false;
    /** Best match among `languages` against `Accept-Language`. */
    acceptsLanguages(...languages: (string | string[])[]): string | string[] | false;
    /** Whether the request `Content-Type` is one of `types`. */
    is(...types: (string | string[])[]): string | false | null;
}
/** Options one response cookie takes. */
export interface CookieOptions {
    /** `Path` attribute; defaults to '/'. */
    path?: string;
    /** `Max-Age` in seconds. */
    maxAge?: number;
    /** Add `Secure`. */
    secure?: boolean;
    /** Add `HttpOnly`; defaults to true, as that is the safe default. */
    httpOnly?: boolean;
    /** `SameSite` attribute. */
    sameSite?: 'Strict' | 'Lax' | 'None';
}
/**
 * A minimal cookie jar over one context.
 *
 * Reading parses the request's `Cookie` header; assigning queues a `Set-Cookie`
 * on the response. Signing and encryption are deliberately absent: a router
 * should not pick a security policy on the caller's behalf.
 */
export declare class CookieJar {
    /** The context this jar reads from and writes to. */
    private readonly context;
    /** Parsed request cookies, computed once. */
    private parsed;
    /**
     * @param context - the context whose request and response this jar uses.
     */
    constructor(context: KoaContext);
    /** Every request cookie, as name → value. */
    get all(): Record<string, string>;
    /** One request cookie, or undefined. */
    get(name: string): string | undefined;
    /**
     * Queue a response cookie.
     *
     * @param name - cookie name.
     * @param value - cookie value.
     * @param options - path, maxAge, secure, httpOnly, sameSite.
     */
    set(name: string, value: string, options?: CookieOptions): void;
    /** Queue a cookie for deletion. */
    delete(name: string, options?: CookieOptions): void;
    /** Lazily parsed request cookies. */
    private entries;
}
/** Build a Koa-shaped context for one request. */
export declare function createKoaContext(request: Request): KoaContext;
//# sourceMappingURL=context.d.ts.map