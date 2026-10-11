/**
 * The routing context: one request, its mutable routing target, and the state a
 * middleware chain reads and rewrites.
 *
 * Everything here is a web standard (`Request`, `Headers`, `URL`), so the same
 * context works in a browser, in Node, and inside an in-process fetch
 * interceptor.
 *
 * @module sac-path-router/core/context
 */
/**
 * The matched-layer facts a context keeps. Structural rather than `Layer<Context>`
 * so a context of any router stays assignable across dialects.
 */
export interface MatchedLayer {
    readonly path: string;
    readonly name: string | null;
    readonly methods: readonly string[];
}
/**
 * Request-scoped facts a host may attach before routing, so routes and
 * middleware can match on them (`ctx.scope.provider`, `ctx.scope.sessionId`).
 */
export interface RouterScope {
    provider?: string;
    model?: string;
    sessionId?: string;
    purpose?: string;
    [key: string]: unknown;
}
/** One routed request. */
export declare class RouterContext {
    /** The request exactly as it arrived. */
    readonly request: Request;
    /** The outgoing target. Mutable: a middleware may rewrite it. */
    url: URL;
    /** Outgoing method. Mutable. */
    method: string;
    /** Outgoing request headers, detached from the incoming request. */
    readonly headers: Headers;
    /**
     * Outgoing request body. Mutable: a middleware may rewrite it.
     *
     * `undefined` means "send whatever the request arrived with". It sits next to
     * `url` / `method` / `headers` because it is the fourth part of the outgoing
     * target, and the only one a body-rewriting middleware has to touch.
     *
     * A middleware that reads `request.body` consumes the stream; it must assign
     * here as well, or the outgoing request has nothing left to send.
     */
    requestBody: BodyInit | null | undefined;
    /** Response headers a local (non-network) route should send. */
    readonly responseHeaders: Headers;
    /** Matched parameters of the current layer. */
    params: Record<string, string>;
    /** Raw captures of the current layer. */
    captures: string[];
    /** Host-owned per-request state; `scope` carries {@link RouterScope}. */
    state: Record<string, unknown>;
    /** Backing field of {@link status}. */
    private statusCode;
    /**
     * Status a local response uses; defaults to 404, as in Koa.
     *
     * Assigning validates the code the way Koa's response setter does, and clears
     * the body for the statuses that must not carry one. A plain field would let
     * `ctx.status = 99` or `ctx.status = 'x'` through to `new Response()`, which
     * throws much later with a far less useful message.
     */
    get status(): number;
    set status(code: number);
    /** Body a local route sets; a string, JSON value, or a `BodyInit`. */
    body: unknown;
    /** Final response. Setting it short-circuits the chain and the network. */
    response?: Response;
    /**
     * Every layer whose path matched, in registration order.
     *
     * Resolved on first read: collecting path matches is the expensive half of
     * matching (a scan in radix mode), and only `allowedMethods()` and the fetch
     * entry's claim check need it, so a plain route hit never pays for it.
     */
    get matched(): MatchedLayer[];
    set matched(value: MatchedLayer[]);
    /**
     * Defer the matched-layer query until {@link matched} is read.
     *
     * **Adds to** whatever earlier routers already contributed, rather than
     * replacing it: when several routers are mounted in one chain each reports
     * its own matches and `allowedMethods()` has to see all of them. The
     * original router pushed onto `ctx.matched` for the same reason.
     *
     * @param provider - resolves this router's matched layers.
     */
    appendMatched(provider: () => MatchedLayer[]): void;
    /** Matched layers once resolved. */
    private matchedLayers;
    /** Pending matched-layer query; cleared by the first read. */
    private matchedProvider?;
    /** The router that dispatched this context. */
    router?: unknown;
    /** Path of the most specific matched layer. */
    routePath?: string;
    /** Name of the most specific matched layer, when it has one. */
    routeName?: string | null;
    /**
     * Path of the most specific layer that actually ran.
     *
     * Underscored because that is the name the original router published, and
     * middleware in the wild reads it.
     */
    _matchedRoute?: string;
    /** Name of the most specific layer that actually ran, when it has one. */
    _matchedRouteName?: string;
    /** Set once a method-constrained route layer actually ran. */
    routed: boolean;
    /** Set once a handler produced a response. */
    private complete;
    /**
     * @param request - the request to route.
     */
    constructor(request: Request);
    /** Routing target path. Assigning it makes the fetch entry re-dispatch. */
    get path(): string;
    set path(value: string);
    /** Query parameters of the current target. */
    get query(): Record<string, string>;
    /**
     * Host this request is addressed to: the outgoing `Host` header when one is
     * set, otherwise the target URL's host. `Router#matchHost` reads it.
     */
    get host(): string;
    /** Alias kept for Koa-shaped middleware. */
    get req(): Request;
    /** First value of one request header. */
    get(name: string): string | null;
    /** Set an outgoing request header. */
    set(name: string, value: string): void;
    /** Host-attached scope, when one was provided. */
    get scope(): RouterScope | undefined;
    set scope(value: RouterScope | undefined);
    /** Mark a local response as produced, so the network is never consulted. */
    respond(response: Response): Response;
    /** Whether a handler already produced the response. */
    get responded(): boolean;
}
/**
 * Build the routing context for one request.
 *
 * @param request - the request to route.
 * @returns a context whose headers are detached from `request`.
 */
export declare function createContext(request: Request): RouterContext;
//# sourceMappingURL=context.d.ts.map