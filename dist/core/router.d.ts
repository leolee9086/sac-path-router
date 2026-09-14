/**
 * Router: registration, matching, and Koa-shaped dispatch over a context.
 *
 * Registration is dialect-neutral — the Express dialect reuses this layer
 * registry and matching, and only swaps the handler signature and the response
 * builder.
 *
 * Registration, `use`, `routes()` dispatch, `allowedMethods`, named routes, and
 * the `GET`-implies-`HEAD` rule are derived from @koa/router's `lib/router.js`
 * (MIT, Copyright (c) 2015 @koajs maintainers and contributors); see
 * THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/core/router
 */
import { type Middleware, type Next } from './compose.js';
import { Layer, type LayerOptions } from './layer.js';
import { type RouterMatcher } from './matchers.js';
import type { RouterContext } from './context.js';
/** Methods a router answers by default. */
export declare const HTTP_METHODS: readonly ["get", "post", "put", "patch", "delete", "head", "options", "all"];
/** One verb shortcut. */
export type HttpMethod = (typeof HTTP_METHODS)[number];
/** Parameter handler, run before the layer stack of a matching route. */
export type ParamHandler<Context> = (value: string, context: Context, next: Next) => unknown;
/** Router-wide options. */
export interface RouterOptions {
    /** Case-sensitive path matching; defaults to false. */
    sensitive?: boolean;
    /** Require the trailing slash; defaults to false. */
    strict?: boolean;
    /** Answer only the most specific matching route. */
    exclusive?: boolean;
    /** Prefix every registered path. */
    prefix?: string;
    /**
     * How a path finds its layers. `regexp` (default) scans in registration order,
     * which is Koa's contract; `radix3` indexes layers in a prefix tree and answers
     * with the most specific match for the method, falling back to the scan for
     * patterns the tree cannot hold.
     */
    matcher?: 'regexp' | 'radix3';
}
/** Result of matching one path and method. */
export interface MatchResult<Context extends RouterContext = RouterContext> {
    /** Layers whose path matched, whatever their methods. */
    path: Layer<Context>[];
    /** Layers whose path and method matched. */
    pathAndMethod: Layer<Context>[];
    /** Whether any layer both matched and constrained its methods. */
    route: boolean;
}
/** One middleware or one mounted router. */
export type UseEntry<Context extends RouterContext> = Middleware<Context> | Router<Context>;
/** An argument `use()` accepts: a path, one entry, or a list of entries. */
export type UseArgument<Context extends RouterContext> = string | UseEntry<Context> | readonly UseEntry<Context>[];
/**
 * A router. Paths are patterns understood by `path-to-regexp`
 * (`/users/:id`, `/files/*`, `/ab?cd`), and a layer registered without a path
 * runs for every request.
 */
export declare class Router<Context extends RouterContext = RouterContext> {
    /** Registered layers, in registration order. */
    readonly stack: Layer<Context>[];
    /** Named routes, addressable through {@link url}. */
    readonly named: Map<string, Layer<Context>>;
    /** Parameter handlers, applied to every later-registered route. */
    readonly params: Record<string, ParamHandler<Context>>;
    /** Effective options, with defaults resolved. */
    readonly settings: RouterOptions & Required<Pick<RouterOptions, 'sensitive' | 'strict' | 'exclusive'>>;
    /** How this router turns a path and method into layers; see {@link RouterOptions.matcher}. */
    readonly matcher: RouterMatcher<Context>;
    /**
     * @param options - matching, exclusivity, prefix, and matcher options.
     */
    constructor(options?: RouterOptions);
    /**
     * Register one path, method set, and middleware stack.
     *
     * @param path - path pattern, or a list of them.
     * @param methods - methods this route answers; empty answers every method.
     * @param middleware - one handler or a stack.
     * @param opts - name, end-matching, and capture options.
     * @returns the created layer.
     */
    register(path: string | readonly string[], methods: readonly string[], middleware: Middleware<Context> | readonly Middleware<Context>[], opts?: LayerOptions): Layer<Context>;
    /**
     * Mount middleware, a sub-router, or several of either.
     *
     * `use(handler)` runs for every request; `use('/prefix', handler)` matches a
     * path prefix and therefore never ends the match.
     */
    use(...args: UseArgument<Context>[]): this;
    /** Register a handler for one or more methods; accepts `(path, ...mw)` or `(name, path, ...mw)`. */
    private verb;
    /** Route `GET` (and `HEAD`). */
    get(...args: [string, ...unknown[]]): this;
    /** Route `POST`. */
    post(...args: [string, ...unknown[]]): this;
    /** Route `PUT`. */
    put(...args: [string, ...unknown[]]): this;
    /** Route `PATCH`. */
    patch(...args: [string, ...unknown[]]): this;
    /** Route `DELETE`. */
    delete(...args: [string, ...unknown[]]): this;
    /** Route `HEAD`. */
    head(...args: [string, ...unknown[]]): this;
    /** Route `OPTIONS`. */
    options(...args: [string, ...unknown[]]): this;
    /** Route every method. */
    all(...args: [string, ...unknown[]]): this;
    /** Register a parameter handler for every route registered afterwards. */
    param(name: string, handler: ParamHandler<Context>): this;
    /** Prefix every layer registered so far. */
    prefix(path: string): this;
    /**
     * Register several routes under one prefix.
     *
     * @param path - prefix for the group.
     * @param configure - receives a child router whose routes are mounted under `path`.
     */
    group(path: string, configure: (router: Router<Context>) => void): this;
    /** The layer registered under `name`, when one exists. */
    route(name: string): Layer<Context> | undefined;
    /** Expand a named route into a URL. */
    url(name: string, ...args: unknown[]): string;
    /** Every layer matching `path` and `method`, as the router's matcher resolves them. */
    match(path: string, method: string): MatchResult<Context>;
    /**
     * Whether some route of this router claims `path`, whatever the method.
     *
     * @param path - the request path.
     * @returns true when a method-constrained layer's path matches.
     */
    claims(path: string): boolean;
    /** Dispatch one context through the matched layers, or call `next` when nothing matched. */
    routes(): (context: Context, next?: Next) => Promise<void>;
    /**
     * Answer `OPTIONS`, `405`, and `501` for matched paths, in Koa's shape.
     *
     * @param options - `throw: true` throws instead of writing the status.
     */
    allowedMethods(options?: {
        throw?: boolean;
    }): Middleware<Context>;
}
/** Convenience factory, so callers need not use `new`. */
export declare function createRouter<Context extends RouterContext = RouterContext>(options?: RouterOptions): Router<Context>;
//# sourceMappingURL=router.d.ts.map