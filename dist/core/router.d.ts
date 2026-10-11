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
/**
 * Methods a router answers by default.
 *
 * The full set @koa/router registers, not just the common ones: a router that
 * only knows eight verbs answers 501 to the other nineteen, and the caller has
 * no way to fix that from outside (see `allowedMethods`).
 */
export declare const HTTP_METHODS: readonly ["get", "post", "put", "head", "delete", "options", "trace", "copy", "lock", "mkcol", "move", "purge", "propfind", "proppatch", "unlock", "report", "mkactivity", "checkout", "merge", "m-search", "notify", "subscribe", "unsubscribe", "patch", "search", "connect"];
/** Methods that route through the router but are not verb shortcuts. */
export declare const HTTP_METHODS_WITH_ALL: readonly ["get", "post", "put", "head", "delete", "options", "trace", "copy", "lock", "mkcol", "move", "purge", "propfind", "proppatch", "unlock", "report", "mkactivity", "checkout", "merge", "m-search", "notify", "subscribe", "unsubscribe", "patch", "search", "connect", "all"];
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
     * Host this router answers for. A string compares for equality against
     * `ctx.host`; a RegExp is tested. Unset means every host.
     */
    host?: string | RegExp;
    /**
     * Methods this router considers implemented, for `allowedMethods`.
     * Defaults to {@link HTTP_METHODS}.
     */
    methods?: readonly string[];
    /**
     * How a path finds its layers. `regexp` (default) scans in registration order,
     * which is Koa's contract; `radix3` indexes layers in a prefix tree and answers
     * with the most specific match for the method, falling back to the scan for
     * patterns the tree cannot hold.
     */
    matcher?: 'regexp' | 'radix3';
}
/** Options {@link Router#allowedMethods} takes. */
export interface AllowedMethodsOptions {
    /** Throw the error instead of writing the status. */
    throw?: boolean;
    /** Error to throw for a method the router does not implement at all. */
    notImplemented?: () => unknown;
    /** Error to throw for a path that exists but not for this method. */
    methodNotAllowed?: () => unknown;
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
    /** Route `DELETE`; the alias @koa/router also exposes. */
    del(...args: [string, ...unknown[]]): this;
    /** Route `HEAD`. */
    head(...args: [string, ...unknown[]]): this;
    /** Route `OPTIONS`. */
    options(...args: [string, ...unknown[]]): this;
    /** Route `TRACE`. */
    trace(...args: [string, ...unknown[]]): this;
    /** Route `COPY`. */
    copy(...args: [string, ...unknown[]]): this;
    /** Route `LOCK`. */
    lock(...args: [string, ...unknown[]]): this;
    /** Route `MKCOL`. */
    mkcol(...args: [string, ...unknown[]]): this;
    /** Route `MOVE`. */
    move(...args: [string, ...unknown[]]): this;
    /** Route `PURGE`. */
    purge(...args: [string, ...unknown[]]): this;
    /** Route `PROPFIND`. */
    propfind(...args: [string, ...unknown[]]): this;
    /** Route `PROPPATCH`. */
    proppatch(...args: [string, ...unknown[]]): this;
    /** Route `UNLOCK`. */
    unlock(...args: [string, ...unknown[]]): this;
    /** Route `REPORT`. */
    report(...args: [string, ...unknown[]]): this;
    /** Route `MKACTIVITY`. */
    mkactivity(...args: [string, ...unknown[]]): this;
    /** Route `CHECKOUT`. */
    checkout(...args: [string, ...unknown[]]): this;
    /** Route `MERGE`. */
    merge(...args: [string, ...unknown[]]): this;
    /** Route `M-SEARCH`; the one verb whose name is not an identifier. */
    'm-search'(...args: [string, ...unknown[]]): this;
    /** Route `NOTIFY`. */
    notify(...args: [string, ...unknown[]]): this;
    /** Route `SUBSCRIBE`. */
    subscribe(...args: [string, ...unknown[]]): this;
    /** Route `UNSUBSCRIBE`. */
    unsubscribe(...args: [string, ...unknown[]]): this;
    /** Route `SEARCH`. */
    search(...args: [string, ...unknown[]]): this;
    /** Route `CONNECT`. */
    connect(...args: [string, ...unknown[]]): this;
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
    /**
     * The layer registered under `name`, or `false` when there is none.
     *
     * `false` rather than `undefined` because that is what the router this was
     * extracted from returns, and callers test the result for truthiness.
     */
    route(name: string): Layer<Context> | false;
    /**
     * Expand a named route into a URL.
     *
     * An unknown name yields an `Error` **as the return value**, not a throw:
     * the original router let callers decide, and `redirect()` relies on it
     * (`if (source instanceof Error) throw source`).
     */
    url(name: string, ...args: unknown[]): string | Error;
    /** Every layer matching `path` and `method`, as the router's matcher resolves them. */
    match(path: string, method: string): MatchResult<Context>;
    /**
     * Whether some route of this router claims `path`, whatever the method.
     *
     * A router configured for another host claims nothing: `routes()` hands such
     * a request straight on, and the fetch entry's "a claimed path is ours, so a
     * method nobody answers is a 405" rule must not fire for a router that never
     * looked at the request.
     *
     * @param path - the request path.
     * @param host - the request's host, when the caller knows it.
     * @returns true when a method-constrained layer's path matches.
     */
    claims(path: string, host?: string): boolean;
    /** Dispatch one context through the matched layers, or call `next` when nothing matched. */
    routes(): (context: Context, next?: Next) => Promise<void>;
    /**
     * Expand a path pattern into a URL without needing a registered route.
     *
     * The router this was extracted from exposed this as a static, so a pattern
     * could be expanded before anything registered it.
     *
     * @param path - the pattern to expand.
     * @param args - parameter values, positional or as one object.
     */
    static url(path: string, ...args: unknown[]): string;
    /**
     * Answer `source` with a redirect to `destination`.
     *
     * Either argument may be a route name instead of a path, and `destination`
     * may be an absolute URL. Default status is 301, as the original used. The
     * body is negotiated: HTML for a browser that asked for it, plain text
     * otherwise.
     */
    redirect(source: string, destination: string, code?: number): this;
    /** A named route's URL; throws when the name is unknown (as `redirect` needs). */
    private expandName;
    /** `routes()`, under the name @koa/router also exposes it as. */
    middleware(): (context: Context, next?: Next) => Promise<void>;
    /**
     * Whether this router answers for `input` as a Host.
     *
     * A string compares for equality; a RegExp is tested. No `host` configured
     * means every host is this router's business. (The router this was extracted
     * from opened with a bare `return true`, so the rest of that function was
     * dead code — this implements the semantics it was clearly meant to have.)
     */
    matchHost(input: string | undefined): boolean;
    /**
     * Answer `OPTIONS`, `405`, and `501` for matched paths, in Koa's shape.
     *
     * @param options - `throw: true` throws instead of writing the status.
     */
    allowedMethods(options?: AllowedMethodsOptions): Middleware<Context>;
}
/** Convenience factory, so callers need not use `new`. */
export declare function createRouter<Context extends RouterContext = RouterContext>(options?: RouterOptions): Router<Context>;
//# sourceMappingURL=router.d.ts.map