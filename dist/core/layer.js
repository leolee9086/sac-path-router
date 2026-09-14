/**
 * Route layer: one path pattern, its methods, and its middleware stack.
 * Matching delegates to `path-to-regexp`, which runs unchanged in browsers and
 * Node, so a pattern means the same thing on both.
 *
 * Layer shape, `setPrefix`, capture handling, and parameter-handler ordering are
 * derived from @koa/router's `lib/layer.js` (MIT, Copyright (c) 2015 @koajs
 * maintainers and contributors); see THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/core/layer
 */
import { compile, parse, pathToRegexp } from 'path-to-regexp';
/** Pattern standing in for a layer whose matching the router's matcher owns. */
const NEVER_MATCHES = /(?!)/;
/**
 * One registered route.
 *
 * `GET` implies `HEAD`, exactly as Koa's router does, so a HEAD probe reaches
 * the same handlers that produced the GET response.
 */
export class Layer {
    /** Absolute pattern this layer matches. */
    path;
    /** Upper-cased method names, or empty for pathless middleware. */
    methods = [];
    /** Parameter descriptors parsed out of {@link path}. */
    paramNames = [];
    /** Middleware this layer contributes. */
    stack = [];
    /** Compiled matcher for {@link path}. */
    regexp;
    /** Route name, or null when it was registered anonymously. */
    name;
    /** The options this layer was created with. */
    opts;
    /**
     * @param path - path pattern.
     * @param methods - methods this layer answers; empty means every method.
     * @param middleware - one handler or a stack of them.
     * @param opts - matching options, name, and prefix.
     */
    constructor(path, methods, middleware, opts = {}) {
        this.opts = opts;
        this.name = opts.name ?? null;
        this.stack = Array.isArray(middleware)
            ? [...middleware]
            : [middleware];
        for (const method of methods) {
            const upper = method.toUpperCase();
            this.methods.push(upper);
            if (upper === 'GET')
                this.methods.unshift('HEAD');
        }
        for (const fn of this.stack) {
            if (typeof fn !== 'function') {
                throw new TypeError(`${methods.toString()} \`${opts.name ?? path}\`: middleware must be a function`);
            }
        }
        this.path = path;
        this.regexp = compilePattern(this.path, this.paramNames, this.opts);
    }
    /** Whether `path` matches this layer. */
    match(path) {
        return this.regexp.test(path);
    }
    /** Captured groups of `path`, or an empty list for a capture-less layer. */
    captures(path) {
        if (this.opts.ignoreCaptures === true)
            return [];
        return path.match(this.regexp)?.slice(1) ?? [];
    }
    /** Named parameters of `path`, merged over `params`. */
    params(path, captures, params = {}) {
        for (let i = 0; i < captures.length; i += 1) {
            const key = this.paramNames[i];
            const capture = captures[i];
            if (key !== undefined && capture !== undefined && capture.length > 0) {
                defineParam(params, String(key.name), safeDecode(capture));
            }
        }
        return params;
    }
    /** Expand this layer's pattern into a URL. */
    url(params, options) {
        let toPath;
        try {
            toPath = compile(this.path, { encode: encodeURIComponent });
        }
        catch (error) {
            // A matcher-owned pattern (radix `**`, for one) has no compiled form here:
            // fill the named segments directly so a named route still expands.
            if (this.opts.toleratePatternErrors !== true)
                throw error;
            toPath = values => this.path.replace(/:([A-Za-z0-9_]+)|\*/g, (match, name) => name === undefined ? String(values['*'] ?? match) : encodeURIComponent(String(values[name] ?? match)));
        }
        const tokens = this.parseTokens();
        let values = {};
        if (Array.isArray(params)) {
            let i = 0;
            for (const token of tokens) {
                if (typeof token === 'object' && token.name !== undefined)
                    values[String(token.name)] = params[i++];
            }
        }
        else if (params !== undefined && typeof params === 'object') {
            values = params;
        }
        const expanded = toPath(values);
        const query = options?.query;
        if (query === undefined)
            return expanded;
        const search = typeof query === 'string' ? query : new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString();
        return search.length === 0 ? expanded : `${expanded}?${search}`;
    }
    /** Prefix this layer's pattern, recompiling its matcher. */
    setPrefix(prefix) {
        this.path = this.path !== '/' || this.opts.strict === true ? `${prefix}${this.path}` : prefix;
        this.paramNames = [];
        this.regexp = compilePattern(this.path, this.paramNames, this.opts);
        return this;
    }
    /** Parsed tokens of this layer's pattern, or none when the matcher owns it. */
    parseTokens() {
        try {
            return parse(this.path);
        }
        catch (error) {
            if (this.opts.toleratePatternErrors !== true)
                throw error;
            return [];
        }
    }
    /**
     * Inject one parameter handler into this layer's stack, ordered before the
     * handlers of every later-declared parameter, as Koa's router does.
     *
     * @param paramName - parameter this handler validates.
     * @param fn - receives the captured value, the context, and the chain's `next`.
     */
    param(paramName, fn) {
        const names = this.paramNames.map(key => key.name);
        const position = names.indexOf(paramName);
        if (position === -1)
            return this;
        const middleware = ((context, next) => fn(context.params[paramName], context, next));
        middleware.param = paramName;
        const inserted = this.stack.some((existing, index) => {
            const marked = existing.param;
            if (marked === undefined || names.indexOf(marked) > position) {
                this.stack.splice(index, 0, middleware);
                return true;
            }
            return false;
        });
        if (!inserted)
            this.stack.push(middleware);
        return this;
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
/**
 * Compile one pattern, or leave it to the router's matcher.
 *
 * @param path - the layer's pattern.
 * @param keys - filled with the pattern's parameter descriptors.
 * @param tolerate - accept a pattern `path-to-regexp` rejects (radix `**`).
 * @returns the compiled matcher, or one that never matches when the pattern is matcher-owned.
 * @throws when the pattern is uncompilable and {@link LayerOptions.toleratePatternErrors} is not set.
 */
function compilePattern(path, keys, opts) {
    try {
        const keys_ = [];
        const regexp = pathToRegexp(path, keys_, opts);
        keys.push(...keys_);
        return regexp;
    }
    catch (error) {
        if (opts.toleratePatternErrors !== true)
            throw error;
        keys.length = 0;
        return NEVER_MATCHES;
    }
}
/**
 * Write one parameter as an own data property.
 *
 * A pattern may name a parameter `__proto__`, `constructor`, or `prototype`;
 * assigning those through `params[name] = value` would reach the prototype
 * chain instead of the parameter bag, which is the prototype-pollution class of
 * router vulnerabilities. Defining the property keeps the value usable and the
 * object's prototype untouched.
 *
 * @param target - parameter bag to write into.
 * @param name - parameter name from the route pattern.
 * @param value - decoded capture.
 */
export function defineParam(target, name, value) {
    Object.defineProperty(target, name, { value, writable: true, enumerable: true, configurable: true });
}
//# sourceMappingURL=layer.js.map