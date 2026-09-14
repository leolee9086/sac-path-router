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
import { createRouter as createRadixTree } from 'radix3';
/** Methods a method-agnostic layer answers. */
export const EVERY_METHOD = '*';
/** Syntax only a regular expression understands, so the tree cannot index it. */
const REGEXP_ONLY = /[()[\]?+|^$]/;
/** Whether a layer is pathless middleware rather than a route. */
function isPathless(layer) {
    return layer.methods.length === 0 && layer.opts.end === false && layer.opts.ignoreCaptures === true;
}
/**
 * Registration-order matching. Every layer's compiled pattern is tested against
 * the path, and all matches run in the order they were registered.
 */
export class RegexpMatcher {
    /** Identifier surfaced through `router.matcher`. */
    kind = 'regexp';
    /** Registered layers, in registration order. */
    layers = [];
    /** Index one newly registered layer. */
    add(layer) {
        this.layers.push(layer);
    }
    /** Layers whose path matches, whatever their methods. */
    matchPath(path) {
        return this.layers.filter(layer => layer.match(path));
    }
    /** Whether some route claims this path. */
    claims(path) {
        return this.layers.some(layer => layer.methods.length > 0 && layer.match(path));
    }
    /** Layers that answer this path and method, with their captured parameters. */
    matchRoute(path, method) {
        const matches = [];
        for (const layer of this.layers) {
            if (!layer.match(path))
                continue;
            if (layer.methods.length > 0 && !layer.methods.includes(method))
                continue;
            matches.push({ layer, params: layer.params(path, layer.captures(path)) });
        }
        return matches;
    }
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
export class Radix3Matcher {
    /** Identifier surfaced through `router.matcher`. */
    kind = 'radix3';
    /** One tree per method, plus {@link EVERY_METHOD} for method-agnostic layers. */
    trees = new Map();
    /** Answers whether any route claims a path, without scanning every layer. */
    claimTree = createRadixTree();
    /** Pathless middleware, run before any matched route. */
    always = [];
    /** Layers whose pattern the tree cannot index; scanned in registration order. */
    fallback = [];
    /** Every layer, for path queries and the fallback scan. */
    layers = [];
    /** Index one newly registered layer. */
    add(layer) {
        this.layers.push(layer);
        if (isPathless(layer)) {
            this.always.push(layer);
            return;
        }
        if (REGEXP_ONLY.test(layer.path)) {
            this.fallback.push(layer);
            if (layer.methods.length > 0)
                this.claimTree.insert(layer.path, { claimed: true });
            return;
        }
        const methods = layer.methods.length > 0 ? layer.methods : [EVERY_METHOD];
        const exact = layer.opts.end !== false;
        for (const method of methods) {
            const tree = this.tree(method);
            tree.insert(layer.path, { layer });
            if (!exact && layer.path !== '/')
                tree.insert(`${layer.path}/**`, { layer });
        }
        if (layer.methods.length > 0) {
            this.claimTree.insert(layer.path, { claimed: true });
            if (!exact && layer.path !== '/')
                this.claimTree.insert(`${layer.path}/**`, { claimed: true });
        }
    }
    /** The tree for one method, created on first use. */
    tree(method) {
        const existing = this.trees.get(method);
        if (existing !== undefined)
            return existing;
        const created = createRadixTree();
        this.trees.set(method, created);
        return created;
    }
    /** Layers whose path matches, whatever their methods. */
    matchPath(path) {
        if (this.fallback.length === 0 && this.claimTree.lookup(path) === null)
            return [];
        return this.layers.filter(layer => !isPathless(layer) && layer.match(path));
    }
    /** Whether some route claims this path; answered by the claim tree, never by a scan. */
    claims(path) {
        if (this.claimTree.lookup(path) !== null)
            return true;
        return this.fallback.some(layer => layer.methods.length > 0 && layer.match(path));
    }
    /** Layers that answer this path and method, with their captured parameters. */
    matchRoute(path, method) {
        const matches = this.always.map(layer => ({ layer, params: {} }));
        const hit = this.lookup(method, path);
        if (hit !== null) {
            matches.push({ layer: hit.layer, params: hit.params ?? {} });
            return matches;
        }
        for (const layer of this.fallback) {
            if (!layer.match(path))
                continue;
            if (layer.methods.length > 0 && !layer.methods.includes(method))
                continue;
            matches.push({ layer, params: layer.params(path, layer.captures(path)) });
        }
        return matches;
    }
    /** Best tree match for one method, preferring the method's own tree over the shared one. */
    lookup(method, path) {
        const own = this.trees.get(method)?.lookup(path);
        if (own !== null && own !== undefined)
            return own;
        const shared = this.trees.get(EVERY_METHOD)?.lookup(path);
        if (shared !== null && shared !== undefined)
            return shared;
        return null;
    }
}
/**
 * Build the matcher a router asked for.
 *
 * @param kind - `regexp` for registration-order dispatch, `radix3` for prefix-tree dispatch.
 * @returns the matcher instance.
 */
export function createMatcher(kind) {
    return kind === 'radix3' ? new Radix3Matcher() : new RegexpMatcher();
}
//# sourceMappingURL=matchers.js.map