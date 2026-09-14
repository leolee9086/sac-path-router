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
    /** Response headers a local (non-network) route should send. */
    responseHeaders = new Headers();
    /** Matched parameters of the current layer. */
    params = {};
    /** Raw captures of the current layer. */
    captures = [];
    /** Host-owned per-request state; `scope` carries {@link RouterScope}. */
    state = {};
    /** Status a local response uses; defaults to 404, as in Koa. */
    status = 404;
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
     * @param provider - resolves the matched layers for this request.
     */
    setMatchedProvider(provider) {
        this.matchedProvider = provider;
        this.matchedLayers = [];
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