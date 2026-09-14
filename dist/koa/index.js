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
export { Router, createRouter } from '../core/router.js';
export { RouterContext, createContext } from '../core/context.js';
export { compose } from '../core/compose.js';
export { createFetchEntry } from '../core/fetch-entry.js';
/**
 * An application: global middleware in front of one router.
 *
 * `app.use(handler)` runs before routing for every request; `app.get(...)` and
 * friends register routes; `app.fetch()` turns the whole thing into a `fetch`
 * function, and `app.handler()` into a plain request handler for a server.
 */
export class Application {
    /** Layers and routes, in registration order. */
    router;
    /** Middleware registered with `app.use(handler)` before any route. */
    middleware = [];
    /**
     * @param options - router options applied to every route registered here.
     */
    constructor(options = {}) {
        this.router = new Router(options);
    }
    /** Register global middleware (no path), a path-scoped middleware, or a mounted router. */
    use(...args) {
        this.router.use(...args);
        return this;
    }
    /** Route `GET` (and `HEAD`). */
    get(path, ...middleware) { this.router.get(path, ...middleware); return this; }
    /** Route `POST`. */
    post(path, ...middleware) { this.router.post(path, ...middleware); return this; }
    /** Route `PUT`. */
    put(path, ...middleware) { this.router.put(path, ...middleware); return this; }
    /** Route `PATCH`. */
    patch(path, ...middleware) { this.router.patch(path, ...middleware); return this; }
    /** Route `DELETE`. */
    delete(path, ...middleware) { this.router.delete(path, ...middleware); return this; }
    /** Route every method. */
    all(path, ...middleware) { this.router.all(path, ...middleware); return this; }
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
        return createFetchEntry({ ...options, router: this.router });
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