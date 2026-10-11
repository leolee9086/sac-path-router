/**
 * Koa dialect: the context-shaped router from the core, plus a small
 * application that owns global middleware and exposes itself as a fetch entry.
 *
 * @module sac-path-router/koa
 */
import { type Middleware, type Next } from '../core/compose.js';
import { RouterContext } from '../core/context.js';
import { type FetchEntry, type FetchEntryOptions } from '../core/fetch-entry.js';
import { Router, type RouterOptions, type UseArgument } from '../core/router.js';
import { KoaContext } from './context.js';
export { KoaContext, createKoaContext } from './context.js';
export { Router, createRouter } from '../core/router.js';
export { RouterContext, createContext } from '../core/context.js';
export { compose } from '../core/compose.js';
export { createFetchEntry } from '../core/fetch-entry.js';
export type { Middleware, Next } from '../core/compose.js';
export type { RouterOptions } from '../core/router.js';
/**
 * An application: global middleware in front of one router.
 *
 * `app.use(handler)` runs before routing for every request; `app.get(...)` and
 * friends register routes; `app.fetch()` turns the whole thing into a `fetch`
 * function, and `app.handler()` into a plain request handler for a server.
 */
/** Options an application takes on top of the router's own. */
export interface ApplicationOptions extends RouterOptions {
    /** Trust `X-Forwarded-*` headers. Defaults to false. */
    proxy?: boolean;
    /** How many trailing labels are the app's own domain. Defaults to 2. */
    subdomainOffset?: number;
    /** Header carrying the forwarded client address. Defaults to `X-Forwarded-For`. */
    proxyIpHeader?: string;
    /** Cap on how many forwarded addresses to keep; 0 means all. */
    maxIpsCount?: number;
    /** Environment name; defaults to `NODE_ENV` or 'development'. */
    env?: string;
    /** Keys for signed cookies. */
    keys?: string[];
    /** Optional logger, surfaced to middleware that wants one. */
    logger?: unknown;
}
/**
 * An application: global middleware in front of one router.
 *
 * `app.use(handler)` runs before routing for every request; the verb shortcuts
 * register routes; `app.fetch()` turns the whole thing into a `fetch` function.
 *
 * The event methods are a deliberately tiny emitter rather than `node:events`,
 * because the core has to load in a browser and error middleware listens for
 * `app.on('error')`.
 */
export declare class Application<Context extends RouterContext = KoaContext> {
    /** Layers and routes, in registration order. */
    readonly router: Router<Context>;
    /** Middleware registered with `app.use(handler)` before any route. */
    readonly middleware: Middleware<Context>[];
    /** Trust `X-Forwarded-*` headers. */
    readonly proxy: boolean;
    /** How many trailing labels are the app's own domain. */
    readonly subdomainOffset: number;
    /** Header carrying the forwarded client address. */
    readonly proxyIpHeader: string;
    /** Cap on how many forwarded addresses to keep. */
    readonly maxIpsCount: number;
    /** Environment name. */
    readonly env: string;
    /** Keys for signed cookies, when the host supplied any. */
    readonly keys: string[] | undefined;
    /** Optional logger, surfaced to middleware that wants one. */
    readonly logger: unknown;
    /** Listeners registered through `on()`. */
    private readonly listeners;
    /**
     * @param options - router options plus the application-level settings.
     */
    constructor(options?: ApplicationOptions);
    /** Listen for `event`; returns a function that removes the listener. */
    on(event: string, listener: (...args: unknown[]) => void): () => void;
    /** Remove one listener. */
    off(event: string, listener: (...args: unknown[]) => void): void;
    /** Emit `event` to every listener. */
    emit(event: string, ...args: unknown[]): void;
    /** Register global middleware (no path), a path-scoped middleware, or a mounted router. */
    use(...args: UseArgument<Context>[]): this;
    /** Route `GET` (and `HEAD`). */
    get(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `POST`. */
    post(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `PUT`. */
    put(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `PATCH`. */
    patch(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `DELETE`. */
    delete(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `DELETE`; the alias the router also exposes. */
    del(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `HEAD`. */
    head(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `OPTIONS`. */
    options(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `TRACE`. */
    trace(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `COPY`. */
    copy(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `LOCK`. */
    lock(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `MKCOL`. */
    mkcol(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `MOVE`. */
    move(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `PURGE`. */
    purge(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `PROPFIND`. */
    propfind(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `PROPPATCH`. */
    proppatch(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `UNLOCK`. */
    unlock(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `REPORT`. */
    report(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `MKACTIVITY`. */
    mkactivity(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `CHECKOUT`. */
    checkout(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `MERGE`. */
    merge(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `M-SEARCH`; the one verb whose name is not an identifier. */
    'm-search'(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `NOTIFY`. */
    notify(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `SUBSCRIBE`. */
    subscribe(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `UNSUBSCRIBE`. */
    unsubscribe(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `SEARCH`. */
    search(path: string, ...mw: Middleware<Context>[]): this;
    /** Route `CONNECT`. */
    connect(path: string, ...mw: Middleware<Context>[]): this;
    /** Route every method. */
    all(path: string, ...mw: Middleware<Context>[]): this;
    /** Register several routes under one prefix. */
    group(path: string, configure: (router: Router<Context>) => void): this;
    /** Answer `OPTIONS`, `405`, and `501` for paths this application handles. */
    allowedMethods(options?: {
        throw?: boolean;
    }): Middleware<Context>;
    /** The routing middleware, for mounting inside another application or router. */
    routes(): (context: Context, next?: Next) => Promise<void>;
    /** A bare request handler: one context in, nothing out but the context's response. */
    handler(): (context: Context, next?: Next) => Promise<void>;
    /**
     * Turn this application into a routed `fetch`.
     *
     * @param options - entry options; `router` is supplied by the application.
     */
    fetch(options?: Omit<FetchEntryOptions<Context>, 'router'>): FetchEntry;
    /**
     * A plain request handler: one web `Request` in, one web `Response` out.
     *
     * This is what a server adapter mounts. Nothing here touches a socket, which
     * is why it works the same in a browser and under `node:http`.
     */
    callback(): (request: Request) => Promise<Response>;
    /** The settings worth printing, mirroring Koa's `toJSON`. */
    toJSON(): Record<string, unknown>;
    /** `inspect` alias, so logging an application prints its settings. */
    inspect(): Record<string, unknown>;
    /** Compose an ad-hoc middleware chain in front of this application's routes. */
    compose(...middleware: Middleware<Context>[]): (context: Context, next?: Next) => Promise<void>;
}
/** Convenience factory, mirroring {@link createRouter}. */
export declare function createApp<Context extends RouterContext = RouterContext>(options?: RouterOptions): Application<Context>;
//# sourceMappingURL=index.d.ts.map