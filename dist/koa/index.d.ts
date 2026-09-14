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
export declare class Application<Context extends RouterContext = RouterContext> {
    /** Layers and routes, in registration order. */
    readonly router: Router<Context>;
    /** Middleware registered with `app.use(handler)` before any route. */
    readonly middleware: Middleware<Context>[];
    /**
     * @param options - router options applied to every route registered here.
     */
    constructor(options?: RouterOptions);
    /** Register global middleware (no path), a path-scoped middleware, or a mounted router. */
    use(...args: UseArgument<Context>[]): this;
    /** Route `GET` (and `HEAD`). */
    get(path: string, ...middleware: Middleware<Context>[]): this;
    /** Route `POST`. */
    post(path: string, ...middleware: Middleware<Context>[]): this;
    /** Route `PUT`. */
    put(path: string, ...middleware: Middleware<Context>[]): this;
    /** Route `PATCH`. */
    patch(path: string, ...middleware: Middleware<Context>[]): this;
    /** Route `DELETE`. */
    delete(path: string, ...middleware: Middleware<Context>[]): this;
    /** Route every method. */
    all(path: string, ...middleware: Middleware<Context>[]): this;
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
    /** Compose an ad-hoc middleware chain in front of this application's routes. */
    compose(...middleware: Middleware<Context>[]): (context: Context, next?: Next) => Promise<void>;
}
/** Convenience factory, mirroring {@link createRouter}. */
export declare function createApp<Context extends RouterContext = RouterContext>(options?: RouterOptions): Application<Context>;
//# sourceMappingURL=index.d.ts.map