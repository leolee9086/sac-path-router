/**
 * Express dialect: `(req, res, next)` handlers over the same standards-based
 * request and response the core uses.
 *
 * `req` is a `Request` (with `params`, `query`, `path`, and `get()`), and `res`
 * is a response builder that materializes a `Response`. Nothing here needs a
 * socket, so the same router runs in a browser, in Node, and as an in-process
 * fetch interceptor.
 *
 * Layer, Route, the `handle` walk, parameter handling, and the four-argument
 * error-middleware convention are derived from Express's `lib/router` (MIT,
 * Copyright (c) 2009-2014 TJ Holowaychuk, 2013-2014 Roman Shtylman, 2014-2015
 * Douglas Christopher Wilson); see THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/express
 */
import { type Key } from 'path-to-regexp';
import type { Next } from '../core/compose.js';
import { RouterContext } from '../core/context.js';
import type { ExpressRouterOptions, ExpressHandler, ExpressErrorHandler, ExpressRequest, ExpressResponse } from './types.js';
export type { ExpressRouterOptions, ExpressHandler, ExpressErrorHandler, ExpressRequest, ExpressResponse } from './types.js';
export { ResponseBuilder } from './response.js';
/** A path parameter validator, run before a matching route's handlers. */
export type ParamCallback = (req: ExpressRequest, res: ExpressResponse, next: (error?: unknown) => void, value: string, name: string) => unknown;
/** One layer: a mount point, a route, or bare middleware. */
declare class ExpressLayer {
    readonly path: string;
    readonly regexp: RegExp;
    readonly keys: Key[];
    readonly handlers: (ExpressHandler | ExpressErrorHandler)[];
    readonly names: string[];
    readonly mounted?: ExpressRouter;
    readonly name?: string;
    constructor(path: string, options: ExpressRouterOptions, handlers: (ExpressHandler | ExpressErrorHandler)[], mounted?: ExpressRouter);
    /** Whether this layer's path matches, treating it as a prefix for mounts. */
    match(path: string): boolean;
    /** Parameters captured out of `path`. */
    params(path: string): Record<string, string>;
    /** Length of the prefix this layer consumed, for mount-path stripping. */
    consumed(path: string): number;
}
/** One route: a path plus one handler stack per method. */
export declare class Route {
    readonly path: string;
    readonly methods: Record<string, boolean>;
    private readonly stacks;
    private readonly router;
    /**
     * @param router - owning router, which supplies options and parameter handlers.
     * @param path - route path pattern.
     */
    constructor(router: ExpressRouter, path: string);
    /** Whether this route answers `method`. */
    handlesMethod(method: string): boolean;
    /** Register handlers for one method. */
    private add;
    /** Register handlers for every method. */
    all(...handlers: (ExpressHandler | ExpressErrorHandler)[]): this;
    /** Register `GET` handlers on this route. */
    get(...handlers: ExpressHandler[]): this;
    /** Register `POST` handlers on this route. */
    post(...handlers: ExpressHandler[]): this;
    /** Register `PUT` handlers on this route. */
    put(...handlers: ExpressHandler[]): this;
    /** Register `PATCH` handlers on this route. */
    patch(...handlers: ExpressHandler[]): this;
    /** Register `DELETE` handlers on this route. */
    delete(...handlers: ExpressHandler[]): this;
    /** Register `HEAD` handlers on this route. */
    head(...handlers: ExpressHandler[]): this;
    /** Register `OPTIONS` handlers on this route. */
    options(...handlers: ExpressHandler[]): this;
    /** The handlers one request runs, in order. */
    handlersFor(method: string): (ExpressHandler | ExpressErrorHandler)[];
    /** Dispatch this route's stack, or hand control back when it does not answer `method`. */
    dispatch(request: ExpressRequest, res: ExpressResponse, method: string, done: (error?: unknown) => void | Promise<void>): Promise<void>;
}
/** An Express-compatible router over standards-based requests and responses. */
export declare class ExpressRouter {
    /** Registered layers, in registration order. */
    readonly stack: ExpressLayer[];
    /** Parameter validators, applied to routes registered afterwards. */
    readonly params: Record<string, ParamCallback>;
    /** Options this router was created with. */
    readonly settings: ExpressRouterOptions;
    /**
     * @param options - case sensitivity, strict matching, and end matching.
     */
    constructor(options?: ExpressRouterOptions);
    /** The router itself, for `use(router)` without a path. */
    get router(): this;
    /**
     * Mount middleware, a sub-router, or a path-scoped stack.
     *
     * `use(handler)` runs for every request; `use('/api', router)` strips the
     * prefix before the sub-router matches.
     */
    use(...args: unknown[]): this;
    /** Register a parameter validator for routes registered afterwards. */
    param(name: string, handler: ParamCallback): this;
    private applyParam;
    /** Register handlers for one method on one path. */
    private add;
    /** Route `GET`. */
    get(path: string, ...handlers: ExpressHandler[]): this;
    /** Route `POST`. */
    post(path: string, ...handlers: ExpressHandler[]): this;
    /** Route `PUT`. */
    put(path: string, ...handlers: ExpressHandler[]): this;
    /** Route `PATCH`. */
    patch(path: string, ...handlers: ExpressHandler[]): this;
    /** Route `DELETE`. */
    delete(path: string, ...handlers: ExpressHandler[]): this;
    /** Route `HEAD`. */
    head(path: string, ...handlers: ExpressHandler[]): this;
    /** Route `OPTIONS`. */
    options(path: string, ...handlers: ExpressHandler[]): this;
    /** Route every method. */
    all(path: string, ...handlers: ExpressHandler[]): this;
    /** Register handlers for every method on every path this router answers. */
    any(path: string, ...handlers: ExpressHandler[]): this;
    /** A route builder: `router.route('/x').get(a).post(b)`. */
    route(path: string): Route;
    /** Compile a path pattern into a URL, when it has named parameters. */
    url(path: string, params?: Record<string, unknown>): string;
    /**
     * Walk the stack for one request.
     *
     * @param request - the express request.
     * @param res - the response builder.
     * @returns nothing; an unhandled error rejects.
     */
    handle(request: ExpressRequest, res: ExpressResponse): Promise<void>;
    /**
     * The router as a core middleware, so a fetch entry can dispatch into it.
     *
     * A handled request becomes a `Response`; an unhandled one falls through to
     * `next`, which the fetch entry wires to the network.
     */
    routes(): (context: RouterContext, next?: Next) => Promise<void>;
    /** Alias of {@link routes}, for Express' own naming. */
    middleware(): (context: RouterContext, next?: Next) => Promise<void>;
}
/** Convenience factory. */
export declare function createRouter(options?: ExpressRouterOptions): ExpressRouter;
/**
 * Present one routing context as an Express request.
 *
 * `path` and `query` stay live views of the context, so a handler that rewrites
 * `ctx.path` sees the new value and the fetch entry re-dispatches accordingly.
 *
 * @param context - the routing context.
 * @returns a `Request` carrying `params`, `query`, `path`, `originalUrl`, and `get()`.
 */
export declare function createExpressRequest(context: RouterContext): ExpressRequest;
//# sourceMappingURL=index.d.ts.map