/**
 * Matchers: the seam between the router and how a path finds its layers.
 *
 * `regexp` (the default) scans layers in registration order, which is Koa's
 * dispatch contract. `radix3` indexes layers in a prefix tree and answers with
 * the most specific match for the method, falling back to the same scan when a
 * pattern is not expressible in radix syntax — the shape the original webKoa
 * radix routers used, kept here behind one option. {@link Radix3Matcher}
 * follows that original implementation, which is the author's own code.
 *
 * @module sac-path-router/core/matchers
 */
import type { Layer } from './layer.js';
/** Methods a method-agnostic layer answers. */
export declare const EVERY_METHOD = "*";
/** Constraint every matcher's context satisfies; a `Layer` requires it. */
export interface MatchableContext {
    params: Record<string, string>;
}
/** One layer together with the parameters this path produced for it. */
export interface RouteMatch<Context extends MatchableContext> {
    /** The layer to run. */
    layer: Layer<Context>;
    /** Parameters captured for this request. */
    params: Record<string, string>;
}
/** How a router turns a path and method into the layers to run. */
export interface RouterMatcher<Context extends MatchableContext> {
    /** Identifier surfaced through `router.matcher`. */
    readonly kind: 'regexp' | 'radix3';
    /** Index one newly registered layer. */
    add(layer: Layer<Context>): void;
    /** Layers whose path matches, whatever their methods, in registration order. */
    matchPath(path: string): Layer<Context>[];
    /** Whether some route (not pathless middleware) claims this path. */
    claims(path: string): boolean;
    /** Layers that answer this path and method, in dispatch order. */
    matchRoute(path: string, method: string): RouteMatch<Context>[];
}
/**
 * Registration-order matching. Every layer's compiled pattern is tested against
 * the path, and all matches run in the order they were registered.
 */
export declare class RegexpMatcher<Context extends MatchableContext> implements RouterMatcher<Context> {
    /** Identifier surfaced through `router.matcher`. */
    readonly kind: "regexp";
    /** Registered layers, in registration order. */
    protected readonly layers: Layer<Context>[];
    /** Index one newly registered layer. */
    add(layer: Layer<Context>): void;
    /** Layers whose path matches, whatever their methods. */
    matchPath(path: string): Layer<Context>[];
    /** Whether some route claims this path. */
    claims(path: string): boolean;
    /** Layers that answer this path and method, with their captured parameters. */
    matchRoute(path: string, method: string): RouteMatch<Context>[];
}
/**
 * Prefix-tree matching: one tree per method plus a shared tree for
 * method-agnostic layers, a claim tree that answers "does some route own this
 * path" without scanning, and a fallback list for patterns the tree cannot hold.
 *
 * Dispatch follows radix semantics: pathless middleware registered here runs
 * first, then the single most specific route for the method. A path no tree
 * entry matches falls back to the registration-order scan, which is also what
 * keeps `(.*)`-style patterns working.
 */
export declare class Radix3Matcher<Context extends MatchableContext> implements RouterMatcher<Context> {
    /** Identifier surfaced through `router.matcher`. */
    readonly kind: "radix3";
    /** One tree per method, plus {@link EVERY_METHOD} for method-agnostic layers. */
    private readonly trees;
    /** Answers whether any route claims a path, without scanning every layer. */
    private readonly claimTree;
    /** Pathless middleware, run before any matched route. */
    private readonly always;
    /** Layers whose pattern the tree cannot index; scanned in registration order. */
    private readonly fallback;
    /** Every layer, for path queries and the fallback scan. */
    private readonly layers;
    /** Index one newly registered layer. */
    add(layer: Layer<Context>): void;
    /** The tree for one method, created on first use. */
    private tree;
    /** Layers whose path matches, whatever their methods. */
    matchPath(path: string): Layer<Context>[];
    /** Whether some route claims this path; answered by the claim tree, never by a scan. */
    claims(path: string): boolean;
    /** Layers that answer this path and method, with their captured parameters. */
    matchRoute(path: string, method: string): RouteMatch<Context>[];
    /** Best tree match for one method, preferring the method's own tree over the shared one. */
    private lookup;
}
/**
 * Build the matcher a router asked for.
 *
 * @param kind - `regexp` for registration-order dispatch, `radix3` for prefix-tree dispatch.
 * @returns the matcher instance.
 */
export declare function createMatcher<Context extends MatchableContext>(kind: 'regexp' | 'radix3'): RouterMatcher<Context>;
//# sourceMappingURL=matchers.d.ts.map