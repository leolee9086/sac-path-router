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
import { type Key } from 'path-to-regexp';
import type { Middleware, Next } from './compose.js';
/** Options a layer accepts; the matching ones are forwarded to `path-to-regexp`. */
export interface LayerOptions {
    /** Route name, addressable through `Router#url`. */
    name?: string | null;
    /** Case-sensitive matching; defaults to false. */
    sensitive?: boolean;
    /** Require the trailing slash; defaults to false. */
    strict?: boolean;
    /** `false` matches a prefix instead of the whole path; defaults to true. */
    end?: boolean;
    /** Prefix prepended to `path`. */
    prefix?: string;
    /** Capture nothing; used for pathless `use()` middleware. */
    ignoreCaptures?: boolean;
    /**
     * Accept a pattern `path-to-regexp` cannot compile, leaving that pattern's
     * matching to the router's matcher. Radix syntax (`**`) needs this; by default
     * an uncompilable pattern is rejected at registration.
     */
    toleratePatternErrors?: boolean;
}
/**
 * One registered route.
 *
 * `GET` implies `HEAD`, exactly as Koa's router does, so a HEAD probe reaches
 * the same handlers that produced the GET response.
 */
export declare class Layer<Context extends {
    params: Record<string, string>;
}> {
    /** Absolute pattern this layer matches. */
    path: string;
    /** Upper-cased method names, or empty for pathless middleware. */
    readonly methods: string[];
    /** Parameter descriptors parsed out of {@link path}. */
    paramNames: Key[];
    /** Middleware this layer contributes. */
    readonly stack: Middleware<Context>[];
    /** Compiled matcher for {@link path}. */
    regexp: RegExp;
    /** Route name, or null when it was registered anonymously. */
    readonly name: string | null;
    /** The options this layer was created with. */
    readonly opts: LayerOptions;
    /**
     * @param path - path pattern.
     * @param methods - methods this layer answers; empty means every method.
     * @param middleware - one handler or a stack of them.
     * @param opts - matching options, name, and prefix.
     */
    constructor(path: string, methods: readonly string[], middleware: Middleware<Context> | readonly Middleware<Context>[], opts?: LayerOptions);
    /** Whether `path` matches this layer. */
    match(path: string): boolean;
    /** Captured groups of `path`, or an empty list for a capture-less layer. */
    captures(path: string): string[];
    /** Named parameters of `path`, merged over `params`. */
    params(path: string, captures: readonly string[], params?: Record<string, string>): Record<string, string>;
    /** Expand this layer's pattern into a URL. */
    url(params?: unknown, options?: {
        query?: string | Record<string, unknown>;
    }): string;
    /** Prefix this layer's pattern, recompiling its matcher. */
    setPrefix(prefix: string): this;
    /** Parsed tokens of this layer's pattern, or none when the matcher owns it. */
    private parseTokens;
    /**
     * Inject one parameter handler into this layer's stack, ordered before the
     * handlers of every later-declared parameter, as Koa's router does.
     *
     * @param paramName - parameter this handler validates.
     * @param fn - receives the captured value, the context, and the chain's `next`.
     */
    param(paramName: string, fn: (value: string, context: Context, next: Next) => unknown): this;
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
export declare function defineParam(target: Record<string, string>, name: string, value: string): void;
//# sourceMappingURL=layer.d.ts.map