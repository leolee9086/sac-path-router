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
import { compile, pathToRegexp } from 'path-to-regexp';
import { RouterContext } from '../core/context.js';
import { ResponseBuilder } from './response.js';
export { ResponseBuilder } from './response.js';
/** Methods the router answers, matching Express' defaults closely enough for routing. */
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
/** One layer: a mount point, a route, or bare middleware. */
class ExpressLayer {
    path;
    regexp;
    keys = [];
    handlers;
    names;
    mounted;
    name;
    constructor(path, options, handlers, mounted) {
        this.path = path;
        this.regexp = pathToRegexp(path, this.keys, { end: options.strictEnd !== false && mounted === undefined, sensitive: options.caseSensitive === true, strict: options.strict === true });
        this.handlers = handlers;
        this.names = [];
        if (mounted !== undefined)
            this.mounted = mounted;
    }
    /** Whether this layer's path matches, treating it as a prefix for mounts. */
    match(path) {
        return this.regexp.test(path);
    }
    /** Parameters captured out of `path`. */
    params(path) {
        const captures = path.match(this.regexp)?.slice(1) ?? [];
        const params = {};
        for (let i = 0; i < captures.length; i += 1) {
            const key = this.keys[i];
            const capture = captures[i];
            if (key !== undefined && capture !== undefined && capture.length > 0) {
                params[key.name] = safeDecode(capture);
            }
        }
        return params;
    }
    /** Length of the prefix this layer consumed, for mount-path stripping. */
    consumed(path) {
        const matched = this.regexp.exec(path);
        return matched === null ? 0 : matched[0].length;
    }
}
/** One route: a path plus one handler stack per method. */
export class Route {
    path;
    methods = Object.create(null);
    stacks = new Map();
    router;
    /**
     * @param router - owning router, which supplies options and parameter handlers.
     * @param path - route path pattern.
     */
    constructor(router, path) {
        this.router = router;
        this.path = path;
    }
    /** Whether this route answers `method`. */
    handlesMethod(method) {
        const name = method.toLowerCase();
        if (name === 'head' && this.methods['get'] === true)
            return true;
        return this.methods[name] === true;
    }
    /** Register handlers for one method. */
    add(method, handlers) {
        const name = method.toLowerCase();
        this.methods[name] = true;
        this.stacks.set(name, [...(this.stacks.get(name) ?? []), ...handlers]);
        if (name === 'get') {
            this.methods['head'] = true;
            this.stacks.set('head', [...(this.stacks.get('head') ?? []), ...handlers]);
        }
        return this;
    }
    /** Register handlers for every method. */
    all(...handlers) {
        for (const method of METHODS)
            this.add(method, handlers);
        return this;
    }
    /** Register `GET` handlers on this route. */
    get(...handlers) { return this.add('get', handlers); }
    /** Register `POST` handlers on this route. */
    post(...handlers) { return this.add('post', handlers); }
    /** Register `PUT` handlers on this route. */
    put(...handlers) { return this.add('put', handlers); }
    /** Register `PATCH` handlers on this route. */
    patch(...handlers) { return this.add('patch', handlers); }
    /** Register `DELETE` handlers on this route. */
    delete(...handlers) { return this.add('delete', handlers); }
    /** Register `HEAD` handlers on this route. */
    head(...handlers) { return this.add('head', handlers); }
    /** Register `OPTIONS` handlers on this route. */
    options(...handlers) { return this.add('options', handlers); }
    /** The handlers one request runs, in order. */
    handlersFor(method) {
        const name = method.toLowerCase();
        if (name === 'head' && this.methods['head'] !== true && this.methods['get'] === true) {
            return this.stacks.get('get') ?? [];
        }
        return this.stacks.get(name) ?? [];
    }
    /** Dispatch this route's stack, or hand control back when it does not answer `method`. */
    async dispatch(request, res, method, done) {
        if (!this.handlesMethod(method))
            return await done();
        const handlers = this.handlersFor(method);
        let index = 0;
        let error;
        const step = async (nextError) => {
            if (nextError !== undefined)
                error = nextError;
            while (index < handlers.length) {
                const handler = handlers[index];
                index += 1;
                if (error === undefined) {
                    if (handler.length >= 4)
                        continue;
                    await invoke(handler, request, res, step);
                }
                else {
                    if (handler.length < 4)
                        continue;
                    const current = error;
                    error = undefined;
                    await invokeError(handler, current, request, res, step);
                }
                if (res.headersSent)
                    return;
            }
            await done(error);
        };
        await step();
    }
}
/** An Express-compatible router over standards-based requests and responses. */
export class ExpressRouter {
    /** Registered layers, in registration order. */
    stack = [];
    /** Parameter validators, applied to routes registered afterwards. */
    params = {};
    /** Options this router was created with. */
    settings;
    /**
     * @param options - case sensitivity, strict matching, and end matching.
     */
    constructor(options = {}) {
        this.settings = options;
    }
    /** The router itself, for `use(router)` without a path. */
    get router() {
        return this;
    }
    /**
     * Mount middleware, a sub-router, or a path-scoped stack.
     *
     * `use(handler)` runs for every request; `use('/api', router)` strips the
     * prefix before the sub-router matches.
     */
    use(...args) {
        let path = '/';
        const rest = [...args];
        if (typeof rest[0] === 'string') {
            path = rest.shift();
            if (Array.isArray(rest[0]))
                rest.splice(0, 1, ...rest[0]);
        }
        for (const entry of rest) {
            if (entry instanceof ExpressRouter) {
                this.stack.push(new ExpressLayer(path, { ...this.settings, strictEnd: false }, [], entry));
                continue;
            }
            if (typeof entry !== 'function')
                throw new TypeError('use() expects middleware or a router');
            const layer = new ExpressLayer(path, { ...this.settings, strictEnd: false }, [entry]);
            for (const [name, handler] of Object.entries(this.params))
                this.applyParam(layer, name, handler);
            this.stack.push(layer);
        }
        return this;
    }
    /** Register a parameter validator for routes registered afterwards. */
    param(name, handler) {
        this.params[name] = handler;
        for (const layer of this.stack)
            this.applyParam(layer, name, handler);
        return this;
    }
    applyParam(layer, name, handler) {
        const key = layer.keys.find(entry => entry.name === name);
        if (key === undefined)
            return;
        layer.handlers.unshift(((request, res, next) => {
            const value = request.params[name];
            // Express runs a parameter handler once per (name, value) per request,
            // however many layers capture it.
            const seen = request.paramCache ?? (request.paramCache = new Set());
            const token = `${name}\u0000${value}`;
            if (seen.has(token))
                return next();
            seen.add(token);
            return handler(request, res, next, value, name);
        }));
    }
    /** Register handlers for one method on one path. */
    add(method, path, handlers) {
        const layer = new ExpressLayer(path, this.settings, handlers);
        for (const [name, handler] of Object.entries(this.params))
            this.applyParam(layer, name, handler);
        this.stack.push(layer);
        return this;
    }
    /** Route `GET`. */
    get(path, ...handlers) { return this.add('get', path, handlers); }
    /** Route `POST`. */
    post(path, ...handlers) { return this.add('post', path, handlers); }
    /** Route `PUT`. */
    put(path, ...handlers) { return this.add('put', path, handlers); }
    /** Route `PATCH`. */
    patch(path, ...handlers) { return this.add('patch', path, handlers); }
    /** Route `DELETE`. */
    delete(path, ...handlers) { return this.add('delete', path, handlers); }
    /** Route `HEAD`. */
    head(path, ...handlers) { return this.add('head', path, handlers); }
    /** Route `OPTIONS`. */
    options(path, ...handlers) { return this.add('options', path, handlers); }
    /** Route every method. */
    all(path, ...handlers) {
        for (const method of METHODS)
            this.add(method, path, handlers);
        return this;
    }
    /** Register handlers for every method on every path this router answers. */
    any(path, ...handlers) {
        return this.all(path, ...handlers);
    }
    /** A route builder: `router.route('/x').get(a).post(b)`. */
    route(path) {
        const route = new Route(this, path);
        this.stack.push(new ExpressLayer(path, this.settings, [((request, res, next) => (route.dispatch(request, res, request.method, async (error) => { await next(error); })))]));
        return route;
    }
    /** Compile a path pattern into a URL, when it has named parameters. */
    url(path, params = {}) {
        return compile(path, { encode: encodeURIComponent })(params);
    }
    /**
     * Walk the stack for one request.
     *
     * @param request - the express request.
     * @param res - the response builder.
     * @returns nothing; an unhandled error rejects.
     */
    async handle(request, res) {
        const dispatch = async (index, error) => {
            const layer = this.stack[index];
            if (layer === undefined) {
                if (error !== undefined)
                    throw error;
                return;
            }
            const path = request.path;
            if (!layer.match(path))
                return await dispatch(index + 1, error);
            const next = (nextError) => dispatch(index + 1, nextError === undefined ? error : nextError);
            if (error !== undefined) {
                const handler = layer.handlers.find(entry => entry.length >= 4);
                if (handler === undefined)
                    return await next();
                await invokeError(handler, error, request, res, next);
                return;
            }
            if (layer.mounted !== undefined) {
                const consumed = layer.consumed(path);
                request.mountOffset += consumed;
                try {
                    await layer.mounted.handle(request, res);
                }
                finally {
                    request.mountOffset -= consumed;
                }
                if (res.headersSent)
                    return;
                return await next();
            }
            request.params = { ...layer.params(path.slice(request.mountOffset)), ...request.params };
            const handler = layer.handlers.find(entry => entry.length < 4);
            if (handler === undefined)
                return await next();
            await invoke(handler, request, res, next);
            if (res.headersSent)
                return;
            // A layer whose handler never called next() ends the walk, as in Express.
        };
        await dispatch(0, undefined);
    }
    /**
     * The router as a core middleware, so a fetch entry can dispatch into it.
     *
     * A handled request becomes a `Response`; an unhandled one falls through to
     * `next`, which the fetch entry wires to the network.
     */
    routes() {
        const router = this;
        return async function dispatch(context, next) {
            const request = createExpressRequest(context);
            const res = new ResponseBuilder(context);
            await router.handle(request, res);
            if (res.headersSent)
                return;
            if (next !== undefined)
                await next();
        };
    }
    /** Alias of {@link routes}, for Express' own naming. */
    middleware() {
        return this.routes();
    }
}
/** Convenience factory. */
export function createRouter(options) {
    return new ExpressRouter(options);
}
/**
 * Present one routing context as an Express request.
 *
 * `path` and `query` stay live views of the context, so a handler that rewrites
 * `ctx.path` sees the new value and the fetch entry re-dispatches accordingly.
 *
 * @param context - the routing context.
 * @returns a `Request` carrying `params`, `query`, `path`, `originalUrl`, and `get()`.
 */
export function createExpressRequest(context) {
    const request = context.request;
    request.params = {};
    request.mountOffset = 0;
    request.originalUrl = `${context.url.pathname}${context.url.search}`;
    Object.defineProperty(request, 'path', { get: () => context.path.slice(request.mountOffset), configurable: true });
    Object.defineProperty(request, 'query', { get: () => context.query, configurable: true });
    request.get = (name) => context.get(name);
    request.header = request.get;
    return request;
}
/** Call one handler, treating a synchronous throw as a chain error. */
async function invoke(handler, request, res, next) {
    try {
        await handler(request, res, next);
    }
    catch (error) {
        await next(error);
    }
}
/** Call one error handler, letting a throw from it continue the chain. */
async function invokeError(handler, error, request, res, next) {
    try {
        await handler(error, request, res, next);
    }
    catch (nextError) {
        await next(nextError);
    }
}
/** Decode one capture, keeping the raw text when it is not valid percent-encoding. */
function safeDecode(text) {
    try {
        return decodeURIComponent(text);
    }
    catch {
        return text;
    }
}
//# sourceMappingURL=index.js.map