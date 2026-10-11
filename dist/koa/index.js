/**
 * Koa dialect: the context-shaped router from the core, plus a small
 * application that owns global middleware and exposes itself as a fetch entry.
 *
 * @module sac-path-router/koa
 */
import { compose } from '../core/compose.js';
import { RouterContext, createContext } from '../core/context.js';
import { createFetchEntry } from '../core/fetch-entry.js';
import { Router, createRouter } from '../core/router.js';
import { KoaContext, createKoaContext } from './context.js';
export { KoaContext, createKoaContext } from './context.js';
export { Router, createRouter } from '../core/router.js';
export { RouterContext, createContext } from '../core/context.js';
export { compose } from '../core/compose.js';
export { createFetchEntry } from '../core/fetch-entry.js';
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
export class Application {
    /** Layers and routes, in registration order. */
    router;
    /** Middleware registered with `app.use(handler)` before any route. */
    middleware = [];
    /** Trust `X-Forwarded-*` headers. */
    proxy;
    /** How many trailing labels are the app's own domain. */
    subdomainOffset;
    /** Header carrying the forwarded client address. */
    proxyIpHeader;
    /** Cap on how many forwarded addresses to keep. */
    maxIpsCount;
    /** Environment name. */
    env;
    /** Keys for signed cookies, when the host supplied any. */
    keys;
    /** Optional logger, surfaced to middleware that wants one. */
    logger;
    /** Listeners registered through `on()`. */
    listeners = new Map();
    /**
     * @param options - router options plus the application-level settings.
     */
    constructor(options = {}) {
        this.router = new Router(options);
        this.proxy = options.proxy ?? false;
        this.subdomainOffset = options.subdomainOffset ?? 2;
        this.proxyIpHeader = options.proxyIpHeader ?? 'X-Forwarded-For';
        this.maxIpsCount = options.maxIpsCount ?? 0;
        this.env = options.env ?? 'development';
        this.keys = options.keys;
        this.logger = options.logger;
    }
    /** Listen for `event`; returns a function that removes the listener. */
    on(event, listener) {
        const list = this.listeners.get(event) ?? [];
        list.push(listener);
        this.listeners.set(event, list);
        return () => this.off(event, listener);
    }
    /** Remove one listener. */
    off(event, listener) {
        const list = this.listeners.get(event);
        if (list === undefined)
            return;
        const at = list.indexOf(listener);
        if (at !== -1)
            list.splice(at, 1);
    }
    /** Emit `event` to every listener. */
    emit(event, ...args) {
        for (const listener of [...(this.listeners.get(event) ?? [])])
            listener(...args);
    }
    /** Register global middleware (no path), a path-scoped middleware, or a mounted router. */
    use(...args) {
        this.router.use(...args);
        return this;
    }
    /** Route `GET` (and `HEAD`). */
    get(path, ...mw) { this.router.get(path, ...mw); return this; }
    /** Route `POST`. */
    post(path, ...mw) { this.router.post(path, ...mw); return this; }
    /** Route `PUT`. */
    put(path, ...mw) { this.router.put(path, ...mw); return this; }
    /** Route `PATCH`. */
    patch(path, ...mw) { this.router.patch(path, ...mw); return this; }
    /** Route `DELETE`. */
    delete(path, ...mw) { this.router.delete(path, ...mw); return this; }
    /** Route `DELETE`; the alias the router also exposes. */
    del(path, ...mw) { this.router.del(path, ...mw); return this; }
    /** Route `HEAD`. */
    head(path, ...mw) { this.router.head(path, ...mw); return this; }
    /** Route `OPTIONS`. */
    options(path, ...mw) { this.router.options(path, ...mw); return this; }
    /** Route `TRACE`. */
    trace(path, ...mw) { this.router.trace(path, ...mw); return this; }
    /** Route `COPY`. */
    copy(path, ...mw) { this.router.copy(path, ...mw); return this; }
    /** Route `LOCK`. */
    lock(path, ...mw) { this.router.lock(path, ...mw); return this; }
    /** Route `MKCOL`. */
    mkcol(path, ...mw) { this.router.mkcol(path, ...mw); return this; }
    /** Route `MOVE`. */
    move(path, ...mw) { this.router.move(path, ...mw); return this; }
    /** Route `PURGE`. */
    purge(path, ...mw) { this.router.purge(path, ...mw); return this; }
    /** Route `PROPFIND`. */
    propfind(path, ...mw) { this.router.propfind(path, ...mw); return this; }
    /** Route `PROPPATCH`. */
    proppatch(path, ...mw) { this.router.proppatch(path, ...mw); return this; }
    /** Route `UNLOCK`. */
    unlock(path, ...mw) { this.router.unlock(path, ...mw); return this; }
    /** Route `REPORT`. */
    report(path, ...mw) { this.router.report(path, ...mw); return this; }
    /** Route `MKACTIVITY`. */
    mkactivity(path, ...mw) { this.router.mkactivity(path, ...mw); return this; }
    /** Route `CHECKOUT`. */
    checkout(path, ...mw) { this.router.checkout(path, ...mw); return this; }
    /** Route `MERGE`. */
    merge(path, ...mw) { this.router.merge(path, ...mw); return this; }
    /** Route `M-SEARCH`; the one verb whose name is not an identifier. */
    'm-search'(path, ...mw) { this.router['m-search'](path, ...mw); return this; }
    /** Route `NOTIFY`. */
    notify(path, ...mw) { this.router.notify(path, ...mw); return this; }
    /** Route `SUBSCRIBE`. */
    subscribe(path, ...mw) { this.router.subscribe(path, ...mw); return this; }
    /** Route `UNSUBSCRIBE`. */
    unsubscribe(path, ...mw) { this.router.unsubscribe(path, ...mw); return this; }
    /** Route `SEARCH`. */
    search(path, ...mw) { this.router.search(path, ...mw); return this; }
    /** Route `CONNECT`. */
    connect(path, ...mw) { this.router.connect(path, ...mw); return this; }
    /** Route every method. */
    all(path, ...mw) { this.router.all(path, ...mw); return this; }
    /** Register several routes under one prefix. */
    group(path, configure) {
        this.router.group(path, configure);
        return this;
    }
    /** Answer `OPTIONS`, `405`, and `501` for paths this application handles. */
    allowedMethods(options = {}) {
        return this.router.allowedMethods(options);
    }
    /** The routing middleware, for mounting inside another application or router. */
    routes() {
        return this.router.routes();
    }
    /** A bare request handler: one context in, nothing out but the context's response. */
    handler() {
        const run = this.routes();
        return (context, next) => run(context, next);
    }
    /**
     * Turn this application into a routed `fetch`.
     *
     * @param options - entry options; `router` is supplied by the application.
     */
    fetch(options = {}) {
        // The Koa context is the default here: middleware written for Koa reaches
        // for `ctx.throw`, `ctx.accepts` and friends, and none of that exists on the
        // core context. A caller may still supply its own factory.
        const supplied = options.createContext;
        const settings = {
            proxy: this.proxy,
            subdomainOffset: this.subdomainOffset,
            proxyIpHeader: this.proxyIpHeader,
            maxIpsCount: this.maxIpsCount,
        };
        const createContextOption = (request) => {
            const context = supplied === undefined
                ? createKoaContext(request)
                : supplied(request);
            context.appOptions = settings;
            context.app = this;
            return context;
        };
        return createFetchEntry({ ...options, createContext: createContextOption, router: this.router });
    }
    /**
     * A plain request handler: one web `Request` in, one web `Response` out.
     *
     * This is what a server adapter mounts. Nothing here touches a socket, which
     * is why it works the same in a browser and under `node:http`.
     */
    callback() {
        const run = this.fetch();
        return request => run(request);
    }
    /** The settings worth printing, mirroring Koa's `toJSON`. */
    toJSON() {
        return {
            subdomainOffset: this.subdomainOffset,
            proxy: this.proxy,
            env: this.env,
        };
    }
    /** `inspect` alias, so logging an application prints its settings. */
    inspect() {
        return this.toJSON();
    }
    /** Compose an ad-hoc middleware chain in front of this application's routes. */
    compose(...middleware) {
        return compose([...middleware, this.routes()]);
    }
}
/** Convenience factory, mirroring {@link createRouter}. */
export function createApp(options) {
    return new Application(options);
}
//# sourceMappingURL=index.js.map