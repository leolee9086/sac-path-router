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
/** One routed request. */
export class RouterContext {
    /** The request exactly as it arrived. */
    request;
    /** The outgoing target. Mutable: a middleware may rewrite it. */
    url;
    /** Outgoing method. Mutable. */
    method;
    /** Outgoing request headers, detached from the incoming request. */
    headers;
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
    requestBody;
    /** Response headers a local (non-network) route should send. */
    responseHeaders = new Headers();
    /** Matched parameters of the current layer. */
    params = {};
    /** Raw captures of the current layer. */
    captures = [];
    /** Host-owned per-request state; `scope` carries {@link RouterScope}. */
    state = {};
    /** Backing field of {@link status}. */
    statusCode = 404;
    /**
     * Status a local response uses; defaults to 404, as in Koa.
     *
     * Assigning validates the code the way Koa's response setter does, and clears
     * the body for the statuses that must not carry one. A plain field would let
     * `ctx.status = 99` or `ctx.status = 'x'` through to `new Response()`, which
     * throws much later with a far less useful message.
     */
    get status() {
        return this.statusCode;
    }
    set status(code) {
        if (!Number.isInteger(code))
            throw new TypeError('status code must be a number');
        if (code < 100 || code > 999)
            throw new RangeError(`invalid status code: ${code}`);
        this.statusCode = code;
        if (code === 204 || code === 205 || code === 304)
            this.body = null;
    }
    /** Body a local route sets; a string, JSON value, or a `BodyInit`. */
    body;
    /** Final response. Setting it short-circuits the chain and the network. */
    response;
    /**
     * Every layer whose path matched, in registration order.
     *
     * Resolved on first read: collecting path matches is the expensive half of
     * matching (a scan in radix mode), and only `allowedMethods()` and the fetch
     * entry's claim check need it, so a plain route hit never pays for it.
     */
    get matched() {
        if (this.matchedProvider !== undefined) {
            this.matchedLayers = this.matchedProvider();
            this.matchedProvider = undefined;
        }
        return this.matchedLayers;
    }
    set matched(value) {
        this.matchedProvider = undefined;
        this.matchedLayers = value;
    }
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
    appendMatched(provider) {
        const earlier = this.matchedProvider;
        if (earlier === undefined) {
            this.matchedProvider = provider;
            return;
        }
        this.matchedProvider = () => [...earlier(), ...provider()];
    }
    /** Matched layers once resolved. */
    matchedLayers = [];
    /** Pending matched-layer query; cleared by the first read. */
    matchedProvider;
    /** The router that dispatched this context. */
    router;
    /** Path of the most specific matched layer. */
    routePath;
    /** Name of the most specific matched layer, when it has one. */
    routeName;
    /**
     * Path of the most specific layer that actually ran.
     *
     * Underscored because that is the name the original router published, and
     * middleware in the wild reads it.
     */
    _matchedRoute;
    /** Name of the most specific layer that actually ran, when it has one. */
    _matchedRouteName;
    /** Set once a method-constrained route layer actually ran. */
    routed = false;
    /** Set once a handler produced a response. */
    complete = false;
    /**
     * @param request - the request to route.
     */
    constructor(request) {
        this.request = request;
        this.url = new URL(request.url);
        this.method = request.method;
        this.headers = new Headers(request.headers);
    }
    /** Routing target path. Assigning it makes the fetch entry re-dispatch. */
    get path() {
        return this.url.pathname;
    }
    set path(value) {
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
            this.url = new URL(value);
            return;
        }
        const next = new URL(this.url);
        const [pathname, search] = value.split('?');
        next.pathname = pathname ?? '/';
        if (search !== undefined)
            next.search = `?${search}`;
        this.url = next;
    }
    /** Query parameters of the current target. */
    get query() {
        return Object.fromEntries(this.url.searchParams);
    }
    /**
     * Host this request is addressed to: the outgoing `Host` header when one is
     * set, otherwise the target URL's host. `Router#matchHost` reads it.
     */
    get host() {
        return this.headers.get('host') ?? this.url.host;
    }
    /** Alias kept for Koa-shaped middleware. */
    get req() {
        return this.request;
    }
    /** First value of one request header. */
    get(name) {
        return this.headers.get(name);
    }
    /** Set an outgoing request header. */
    set(name, value) {
        this.headers.set(name, value);
    }
    /** Host-attached scope, when one was provided. */
    get scope() {
        return this.state['scope'];
    }
    set scope(value) {
        this.state['scope'] = value;
    }
    /** Mark a local response as produced, so the network is never consulted. */
    respond(response) {
        this.response = response;
        this.complete = true;
        return response;
    }
    /** Whether a handler already produced the response. */
    get responded() {
        return this.complete || this.response !== undefined;
    }
}
/**
 * Build the routing context for one request.
 *
 * @param request - the request to route.
 * @returns a context whose headers are detached from `request`.
 */
export function createContext(request) {
    return new RouterContext(request);
}
//# sourceMappingURL=context.js.map