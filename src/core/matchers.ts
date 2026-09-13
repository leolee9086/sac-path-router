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

import { createRouter as createRadixTree } from 'radix3'
import type { Layer } from './layer.js'

/** Methods a method-agnostic layer answers. */
export const EVERY_METHOD = '*'

/** Data stored in a radix tree: the layer, wrapped so the tree can merge its own `params` in. */
interface TreeEntry<Context extends MatchableContext> {
  layer: Layer<Context>
}

/** A radix prefix tree holding {@link TreeEntry} values. */
type RadixTree<Context extends MatchableContext> = ReturnType<typeof createRadixTree<TreeEntry<Context>>>

/** What a radix lookup yields once the tree has merged its parameters in. */
interface TreeHit<Context extends MatchableContext> extends TreeEntry<Context> {
  params?: Record<string, string>
}

/** Constraint every matcher's context satisfies; a `Layer` requires it. */
export interface MatchableContext {
  params: Record<string, string>
}

/** One layer together with the parameters this path produced for it. */
export interface RouteMatch<Context extends MatchableContext> {
  /** The layer to run. */
  layer: Layer<Context>
  /** Parameters captured for this request. */
  params: Record<string, string>
}

/** How a router turns a path and method into the layers to run. */
export interface RouterMatcher<Context extends MatchableContext> {
  /** Identifier surfaced through `router.matcher`. */
  readonly kind: 'regexp' | 'radix3'
  /** Index one newly registered layer. */
  add(layer: Layer<Context>): void
  /** Layers whose path matches, whatever their methods, in registration order. */
  matchPath(path: string): Layer<Context>[]
  /** Whether some route (not pathless middleware) claims this path. */
  claims(path: string): boolean
  /** Layers that answer this path and method, in dispatch order. */
  matchRoute(path: string, method: string): RouteMatch<Context>[]
}

/** Syntax only a regular expression understands, so the tree cannot index it. */
const REGEXP_ONLY = /[()[\]?+|^$]/

/** Whether a layer is pathless middleware rather than a route. */
function isPathless(layer: Layer<MatchableContext>): boolean {
  return layer.methods.length === 0 && layer.opts.end === false && layer.opts.ignoreCaptures === true
}

/**
 * Registration-order matching. Every layer's compiled pattern is tested against
 * the path, and all matches run in the order they were registered.
 */
export class RegexpMatcher<Context extends MatchableContext> implements RouterMatcher<Context> {
  /** Identifier surfaced through `router.matcher`. */
  readonly kind = 'regexp' as const

  /** Registered layers, in registration order. */
  protected readonly layers: Layer<Context>[] = []

  /** Index one newly registered layer. */
  add(layer: Layer<Context>): void {
    this.layers.push(layer)
  }

  /** Layers whose path matches, whatever their methods. */
  matchPath(path: string): Layer<Context>[] {
    return this.layers.filter(layer => layer.match(path))
  }

  /** Whether some route claims this path. */
  claims(path: string): boolean {
    return this.layers.some(layer => layer.methods.length > 0 && layer.match(path))
  }

  /** Layers that answer this path and method, with their captured parameters. */
  matchRoute(path: string, method: string): RouteMatch<Context>[] {
    const matches: RouteMatch<Context>[] = []
    for (const layer of this.layers) {
      if (!layer.match(path)) continue
      if (layer.methods.length > 0 && !layer.methods.includes(method)) continue
      matches.push({ layer, params: layer.params(path, layer.captures(path)) })
    }
    return matches
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
export class Radix3Matcher<Context extends MatchableContext> implements RouterMatcher<Context> {
  /** Identifier surfaced through `router.matcher`. */
  readonly kind = 'radix3' as const

  /** One tree per method, plus {@link EVERY_METHOD} for method-agnostic layers. */
  private readonly trees = new Map<string, RadixTree<Context>>()

  /** Answers whether any route claims a path, without scanning every layer. */
  private readonly claimTree = createRadixTree<{ claimed: true }>()

  /** Pathless middleware, run before any matched route. */
  private readonly always: Layer<Context>[] = []

  /** Layers whose pattern the tree cannot index; scanned in registration order. */
  private readonly fallback: Layer<Context>[] = []

  /** Every layer, for path queries and the fallback scan. */
  private readonly layers: Layer<Context>[] = []

  /** Index one newly registered layer. */
  add(layer: Layer<Context>): void {
    this.layers.push(layer)
    if (isPathless(layer as unknown as Layer<MatchableContext>)) {
      this.always.push(layer)
      return
    }
    if (REGEXP_ONLY.test(layer.path)) {
      this.fallback.push(layer)
      if (layer.methods.length > 0) this.claimTree.insert(layer.path, { claimed: true })
      return
    }
    const methods = layer.methods.length > 0 ? layer.methods : [EVERY_METHOD]
    const exact = layer.opts.end !== false
    for (const method of methods) {
      const tree = this.tree(method)
      tree.insert(layer.path, { layer })
      if (!exact && layer.path !== '/') tree.insert(`${layer.path}/**`, { layer })
    }
    if (layer.methods.length > 0) {
      this.claimTree.insert(layer.path, { claimed: true })
      if (!exact && layer.path !== '/') this.claimTree.insert(`${layer.path}/**`, { claimed: true })
    }
  }

  /** The tree for one method, created on first use. */
  private tree(method: string): RadixTree<Context> {
    const existing = this.trees.get(method)
    if (existing !== undefined) return existing
    const created = createRadixTree<TreeEntry<Context>>()
    this.trees.set(method, created)
    return created
  }

  /** Layers whose path matches, whatever their methods. */
  matchPath(path: string): Layer<Context>[] {
    if (this.fallback.length === 0 && this.claimTree.lookup(path) === null) return []
    return this.layers.filter(layer => !isPathless(layer as unknown as Layer<MatchableContext>) && layer.match(path))
  }

  /** Whether some route claims this path; answered by the claim tree, never by a scan. */
  claims(path: string): boolean {
    if (this.claimTree.lookup(path) !== null) return true
    return this.fallback.some(layer => layer.methods.length > 0 && layer.match(path))
  }

  /** Layers that answer this path and method, with their captured parameters. */
  matchRoute(path: string, method: string): RouteMatch<Context>[] {
    const matches: RouteMatch<Context>[] = this.always.map(layer => ({ layer, params: {} }))
    const hit = this.lookup(method, path)
    if (hit !== null) {
      matches.push({ layer: hit.layer, params: hit.params ?? {} })
      return matches
    }
    for (const layer of this.fallback) {
      if (!layer.match(path)) continue
      if (layer.methods.length > 0 && !layer.methods.includes(method)) continue
      matches.push({ layer, params: layer.params(path, layer.captures(path)) })
    }
    return matches
  }

  /** Best tree match for one method, preferring the method's own tree over the shared one. */
  private lookup(method: string, path: string): TreeHit<Context> | null {
    const own = this.trees.get(method)?.lookup(path)
    if (own !== null && own !== undefined) return own
    const shared = this.trees.get(EVERY_METHOD)?.lookup(path)
    if (shared !== null && shared !== undefined) return shared
    return null
  }
}

/**
 * Build the matcher a router asked for.
 *
 * @param kind - `regexp` for registration-order dispatch, `radix3` for prefix-tree dispatch.
 * @returns the matcher instance.
 */
export function createMatcher<Context extends MatchableContext>(
  kind: 'regexp' | 'radix3',
): RouterMatcher<Context> {
  return kind === 'radix3' ? new Radix3Matcher<Context>() : new RegexpMatcher<Context>()
}
