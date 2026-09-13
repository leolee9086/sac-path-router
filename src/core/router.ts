/**
 * Router: registration, matching, and Koa-shaped dispatch over a context.
 *
 * Registration is dialect-neutral — the Express dialect reuses this layer
 * registry and matching, and only swaps the handler signature and the response
 * builder.
 *
 * @module sac-path-router/core/router
 */

import { compose, type Middleware, type Next } from './compose.js'
import { Layer, type LayerOptions } from './layer.js'
import { createMatcher, type RouteMatch, type RouterMatcher } from './matchers.js'
import type { RouterContext } from './context.js'

/** Methods a router answers by default. */
export const HTTP_METHODS = [
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all',
] as const

/** One verb shortcut. */
export type HttpMethod = (typeof HTTP_METHODS)[number]

/** Parameter handler, run before the layer stack of a matching route. */
export type ParamHandler<Context> = (
  value: string,
  context: Context,
  next: Next,
) => unknown

/** Router-wide options. */
export interface RouterOptions {
  /** Case-sensitive path matching; defaults to false. */
  sensitive?: boolean
  /** Require the trailing slash; defaults to false. */
  strict?: boolean
  /** Answer only the most specific matching route. */
  exclusive?: boolean
  /** Prefix every registered path. */
  prefix?: string
  /**
   * How a path finds its layers. `regexp` (default) scans in registration order,
   * which is Koa's contract; `radix3` indexes layers in a prefix tree and answers
   * with the most specific match for the method, falling back to the scan for
   * patterns the tree cannot hold.
   */
  matcher?: 'regexp' | 'radix3'
}

/** Result of matching one path and method. */
export interface MatchResult<Context extends RouterContext = RouterContext> {
  /** Layers whose path matched, whatever their methods. */
  path: Layer<Context>[]
  /** Layers whose path and method matched. */
  pathAndMethod: Layer<Context>[]
  /** Whether any layer both matched and constrained its methods. */
  route: boolean
}

/** One middleware or one mounted router. */
export type UseEntry<Context extends RouterContext> = Middleware<Context> | Router<Context>

/** An argument `use()` accepts: a path, one entry, or a list of entries. */
export type UseArgument<Context extends RouterContext> = string | UseEntry<Context> | readonly UseEntry<Context>[]

/**
 * A router. Paths are patterns understood by `path-to-regexp`
 * (`/users/:id`, `/files/*`, `/ab?cd`), and a layer registered without a path
 * runs for every request.
 */
export class Router<Context extends RouterContext = RouterContext> {
  /** Registered layers, in registration order. */
  readonly stack: Layer<Context>[] = []

  /** Named routes, addressable through {@link url}. */
  readonly named = new Map<string, Layer<Context>>()

  /** Parameter handlers, applied to every later-registered route. */
  readonly params: Record<string, ParamHandler<Context>> = {}

  /** Effective options, with defaults resolved. */
  readonly settings: RouterOptions & Required<Pick<RouterOptions, 'sensitive' | 'strict' | 'exclusive'>>

  /** How this router turns a path and method into layers; see {@link RouterOptions.matcher}. */
  readonly matcher: RouterMatcher<Context>

  /**
   * @param options - matching, exclusivity, prefix, and matcher options.
   */
  constructor(options: RouterOptions = {}) {
    this.settings = {
      ...options,
      sensitive: options.sensitive ?? false,
      strict: options.strict ?? false,
      exclusive: options.exclusive ?? false,
    }
    this.matcher = createMatcher<Context>(options.matcher ?? 'regexp')
  }

  /**
   * Register one path, method set, and middleware stack.
   *
   * @param path - path pattern, or a list of them.
   * @param methods - methods this route answers; empty answers every method.
   * @param middleware - one handler or a stack.
   * @param opts - name, end-matching, and capture options.
   * @returns the created layer.
   */
  register(
    path: string | readonly string[],
    methods: readonly string[],
    middleware: Middleware<Context> | readonly Middleware<Context>[],
    opts: LayerOptions = {},
  ): Layer<Context> {
    if (Array.isArray(path)) {
      const layers = path.map(one => this.register(one, methods, middleware, opts))
      return layers[layers.length - 1] as Layer<Context>
    }
    const layer = new Layer<Context>(path as string, methods, middleware, {
      sensitive: this.settings.sensitive,
      strict: this.settings.strict,
      prefix: this.settings.prefix ?? '',
      toleratePatternErrors: this.matcher.kind === 'radix3',
      ...opts,
    })
    for (const [name, handler] of Object.entries(this.params)) layer.param(name, handler)
    this.stack.push(layer)
    this.matcher.add(layer)
    if (layer.name !== null) this.named.set(layer.name, layer)
    return layer
  }

  /**
   * Mount middleware, a sub-router, or several of either.
   *
   * `use(handler)` runs for every request; `use('/prefix', handler)` matches a
   * path prefix and therefore never ends the match.
   */
  use(...args: UseArgument<Context>[]): this {
    const rest: UseArgument<Context>[] = []
    let path: string | undefined
    for (const entry of args) {
      if (path === undefined && typeof entry === 'string') {
        path = entry
        continue
      }
      if (Array.isArray(entry)) rest.push(...(entry as readonly UseEntry<Context>[]))
      else rest.push(entry as UseEntry<Context>)
    }
    for (const entry of rest) {
      if (entry instanceof Router) {
        for (const layer of entry.stack) {
          const mounted = new Layer<Context>(`${path ?? ''}${layer.path}`, layer.methods, [...layer.stack], {
            ...layer.opts,
            name: layer.name,
            prefix: '',
          })
          this.stack.push(mounted)
          this.matcher.add(mounted)
          if (mounted.name !== null) this.named.set(mounted.name, mounted)
        }
        continue
      }
      if (typeof entry !== 'function') throw new TypeError('use() expects middleware, a router, or a path')
      this.register(path ?? '([^/]*)', [], entry as Middleware<Context>, {
        end: false,
        ignoreCaptures: path === undefined,
      })
    }
    return this
  }

  /** Register a handler for one or more methods; accepts `(path, ...mw)` or `(name, path, ...mw)`. */
  private verb(method: string, args: [string, ...unknown[]]): this {
    const rest = [...args]
    const first = rest.shift() as string
    let name: string | undefined
    let path = first
    if (typeof rest[0] === 'string') {
      name = first
      path = rest.shift() as string
    }
    for (const entry of rest) {
      if (typeof entry !== 'function') throw new TypeError(`${method} ${path}: middleware must be a function`)
    }
    this.register(path, method === 'all' ? [] : [method], rest as Middleware<Context>[], { name })
    return this
  }

  /** Route `GET` (and `HEAD`). */
  get(...args: [string, ...unknown[]]): this { return this.verb('get', args) }
  /** Route `POST`. */
  post(...args: [string, ...unknown[]]): this { return this.verb('post', args) }
  /** Route `PUT`. */
  put(...args: [string, ...unknown[]]): this { return this.verb('put', args) }
  /** Route `PATCH`. */
  patch(...args: [string, ...unknown[]]): this { return this.verb('patch', args) }
  /** Route `DELETE`. */
  delete(...args: [string, ...unknown[]]): this { return this.verb('delete', args) }
  /** Route `HEAD`. */
  head(...args: [string, ...unknown[]]): this { return this.verb('head', args) }
  /** Route `OPTIONS`. */
  options(...args: [string, ...unknown[]]): this { return this.verb('options', args) }
  /** Route every method. */
  all(...args: [string, ...unknown[]]): this { return this.verb('all', args) }

  /** Register a parameter handler for every route registered afterwards. */
  param(name: string, handler: ParamHandler<Context>): this {
    this.params[name] = handler
    for (const layer of this.stack) layer.param(name, handler)
    return this
  }

  /** Prefix every layer registered so far. */
  prefix(path: string): this {
    const clean = path.replace(/\/$/, '')
    this.settings.prefix = clean
    for (const layer of this.stack) layer.setPrefix(clean)
    return this
  }

  /**
   * Register several routes under one prefix.
   *
   * @param path - prefix for the group.
   * @param configure - receives a child router whose routes are mounted under `path`.
   */
  group(path: string, configure: (router: Router<Context>) => void): this {
    const child = new Router<Context>(this.settings)
    configure(child)
    for (const layer of child.stack) {
      const mounted = new Layer<Context>(`${path}${layer.path}`, layer.methods, [...layer.stack], {
        ...layer.opts,
        name: layer.name,
        prefix: '',
      })
      this.stack.push(mounted)
      this.matcher.add(mounted)
      if (mounted.name !== null) this.named.set(mounted.name, mounted)
    }
    return this
  }

  /** The layer registered under `name`, when one exists. */
  route(name: string): Layer<Context> | undefined {
    return this.named.get(name)
  }

  /** Expand a named route into a URL. */
  url(name: string, ...args: unknown[]): string {
    const layer = this.named.get(name)
    if (layer === undefined) throw new Error(`sac-path-router: no route named "${name}"`)
    return layer.url(...(args as [unknown]))
  }

  /** Every layer matching `path` and `method`, as the router's matcher resolves them. */
  match(path: string, method: string): MatchResult<Context> {
    const pathAndMethod = this.matcher.matchRoute(path, method).map(entry => entry.layer)
    return {
      path: this.matcher.matchPath(path),
      pathAndMethod,
      route: pathAndMethod.some(layer => layer.methods.length > 0),
    }
  }

  /**
   * Whether some route of this router claims `path`, whatever the method.
   *
   * @param path - the request path.
   * @returns true when a method-constrained layer's path matches.
   */
  claims(path: string): boolean {
    return this.matcher.claims(path)
  }

  /** Dispatch one context through the matched layers, or call `next` when nothing matched. */
  routes(): (context: Context, next?: Next) => Promise<void> {
    const router = this
    return function dispatch(context: Context, next?: Next): Promise<void> {
      const path = context.path
      const entries = router.matcher.matchRoute(path, context.method)
      context.setMatchedProvider(() => router.matcher.matchPath(path))
      context.router = router
      // Nothing matched at all: hand the request to the chain's tail, which the
      // fetch entry wires to the network. A path-only match still runs the
      // pathless middleware, so `allowedMethods()` can answer 405.
      if (entries.length === 0) return next === undefined ? Promise.resolve() : next()

      const mostSpecific = (entries[entries.length - 1] as RouteMatch<Context>).layer
      context.routePath = mostSpecific.path
      context.routeName = mostSpecific.name

      const chain: Middleware<Context>[] = []
      for (const entry of router.settings.exclusive ? [entries[entries.length - 1] as RouteMatch<Context>] : entries) {
        const layer = entry.layer
        // A layer never starts once a response exists: two routes both writing
        // is the classic "headers already sent" defect. Post-processing inside
        // an already-started middleware still runs.
        chain.push((inner, innerNext) => (inner.responded ? Promise.resolve() : innerNext()))
        chain.push((inner, innerNext) => {
          const captures = layer.captures(path)
          if (captures.length > 0) inner.captures = captures
          inner.params = { ...inner.params, ...entry.params }
          inner.routePath = layer.path
          inner.routeName = layer.name
          if (layer.methods.length > 0) inner.routed = true
          return innerNext()
        })
        chain.push(...layer.stack)
      }
      const run = compose(chain)
      return next === undefined ? run(context) : run(context, next)
    }
  }

  /**
   * Answer `OPTIONS`, `405`, and `501` for matched paths, in Koa's shape.
   *
   * @param options - `throw: true` throws instead of writing the status.
   */
  allowedMethods(options: { throw?: boolean } = {}): Middleware<Context> {
    const implemented = HTTP_METHODS
    return async (context: Context, next: Next) => {
      await next()
      if (context.responded) return
      if (context.status !== 404) return
      const allowed = new Set<string>()
      for (const layer of context.matched) for (const method of layer.methods) allowed.add(method)
      const list = [...allowed].join(', ')
      if (!implemented.includes(context.method.toLowerCase() as HttpMethod)) {
        if (options.throw === true) throw new Error('sac-path-router: method not implemented')
        context.status = 501
        context.responseHeaders.set('Allow', list)
        return
      }
      if (allowed.size === 0) return
      if (context.method === 'OPTIONS') {
        context.status = 200
        context.body = ''
        context.responseHeaders.set('Allow', list)
        return
      }
      if (!allowed.has(context.method)) {
        if (options.throw === true) throw new Error('sac-path-router: method not allowed')
        context.status = 405
        context.responseHeaders.set('Allow', list)
      }
    }
  }
}

/** Convenience factory, so callers need not use `new`. */
export function createRouter<Context extends RouterContext = RouterContext>(
  options?: RouterOptions,
): Router<Context> {
  return new Router<Context>(options)
}
