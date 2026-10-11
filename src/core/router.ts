/**
 * Router: registration, matching, and Koa-shaped dispatch over a context.
 *
 * Registration is dialect-neutral — the Express dialect reuses this layer
 * registry and matching, and only swaps the handler signature and the response
 * builder.
 *
 * Registration, `use`, `routes()` dispatch, `allowedMethods`, named routes, and
 * the `GET`-implies-`HEAD` rule are derived from @koa/router's `lib/router.js`
 * (MIT, Copyright (c) 2015 @koajs maintainers and contributors); see
 * THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/core/router
 */

import { compose, type Middleware, type Next } from './compose.js'
import { Layer, type LayerOptions } from './layer.js'
import { createMatcher, type RouteMatch, type RouterMatcher } from './matchers.js'
import { methodNotAllowed, notImplemented } from './errors.js'
import type { RouterContext } from './context.js'

/**
 * Methods a router answers by default.
 *
 * The full set @koa/router registers, not just the common ones: a router that
 * only knows eight verbs answers 501 to the other nineteen, and the caller has
 * no way to fix that from outside (see `allowedMethods`).
 */
export const HTTP_METHODS = [
  'get', 'post', 'put', 'head', 'delete', 'options', 'trace', 'copy', 'lock',
  'mkcol', 'move', 'purge', 'propfind', 'proppatch', 'unlock', 'report',
  'mkactivity', 'checkout', 'merge', 'm-search', 'notify', 'subscribe',
  'unsubscribe', 'patch', 'search', 'connect',
] as const

/** Methods that route through the router but are not verb shortcuts. */
export const HTTP_METHODS_WITH_ALL = [...HTTP_METHODS, 'all'] as const

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
   * Host this router answers for. A string compares for equality against
   * `ctx.host`; a RegExp is tested. Unset means every host.
   */
  host?: string | RegExp
  /**
   * Methods this router considers implemented, for `allowedMethods`.
   * Defaults to {@link HTTP_METHODS}.
   */
  methods?: readonly string[]
  /**
   * How a path finds its layers. `regexp` (default) scans in registration order,
   * which is Koa's contract; `radix3` indexes layers in a prefix tree and answers
   * with the most specific match for the method, falling back to the scan for
   * patterns the tree cannot hold.
   */
  matcher?: 'regexp' | 'radix3'
}

/** Options {@link Router#allowedMethods} takes. */
export interface AllowedMethodsOptions {
  /** Throw the error instead of writing the status. */
  throw?: boolean
  /** Error to throw for a method the router does not implement at all. */
  notImplemented?: () => unknown
  /** Error to throw for a path that exists but not for this method. */
  methodNotAllowed?: () => unknown
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
  /** Route `DELETE`; the alias @koa/router also exposes. */
  del(...args: [string, ...unknown[]]): this { return this.verb('delete', args) }
  /** Route `HEAD`. */
  head(...args: [string, ...unknown[]]): this { return this.verb('head', args) }
  /** Route `OPTIONS`. */
  options(...args: [string, ...unknown[]]): this { return this.verb('options', args) }
  /** Route `TRACE`. */
  trace(...args: [string, ...unknown[]]): this { return this.verb('trace', args) }
  /** Route `COPY`. */
  copy(...args: [string, ...unknown[]]): this { return this.verb('copy', args) }
  /** Route `LOCK`. */
  lock(...args: [string, ...unknown[]]): this { return this.verb('lock', args) }
  /** Route `MKCOL`. */
  mkcol(...args: [string, ...unknown[]]): this { return this.verb('mkcol', args) }
  /** Route `MOVE`. */
  move(...args: [string, ...unknown[]]): this { return this.verb('move', args) }
  /** Route `PURGE`. */
  purge(...args: [string, ...unknown[]]): this { return this.verb('purge', args) }
  /** Route `PROPFIND`. */
  propfind(...args: [string, ...unknown[]]): this { return this.verb('propfind', args) }
  /** Route `PROPPATCH`. */
  proppatch(...args: [string, ...unknown[]]): this { return this.verb('proppatch', args) }
  /** Route `UNLOCK`. */
  unlock(...args: [string, ...unknown[]]): this { return this.verb('unlock', args) }
  /** Route `REPORT`. */
  report(...args: [string, ...unknown[]]): this { return this.verb('report', args) }
  /** Route `MKACTIVITY`. */
  mkactivity(...args: [string, ...unknown[]]): this { return this.verb('mkactivity', args) }
  /** Route `CHECKOUT`. */
  checkout(...args: [string, ...unknown[]]): this { return this.verb('checkout', args) }
  /** Route `MERGE`. */
  merge(...args: [string, ...unknown[]]): this { return this.verb('merge', args) }
  /** Route `M-SEARCH`; the one verb whose name is not an identifier. */
  'm-search'(...args: [string, ...unknown[]]): this { return this.verb('m-search', args) }
  /** Route `NOTIFY`. */
  notify(...args: [string, ...unknown[]]): this { return this.verb('notify', args) }
  /** Route `SUBSCRIBE`. */
  subscribe(...args: [string, ...unknown[]]): this { return this.verb('subscribe', args) }
  /** Route `UNSUBSCRIBE`. */
  unsubscribe(...args: [string, ...unknown[]]): this { return this.verb('unsubscribe', args) }
  /** Route `SEARCH`. */
  search(...args: [string, ...unknown[]]): this { return this.verb('search', args) }
  /** Route `CONNECT`. */
  connect(...args: [string, ...unknown[]]): this { return this.verb('connect', args) }
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

  /**
   * The layer registered under `name`, or `false` when there is none.
   *
   * `false` rather than `undefined` because that is what the router this was
   * extracted from returns, and callers test the result for truthiness.
   */
  route(name: string): Layer<Context> | false {
    return this.named.get(name) ?? false
  }

  /**
   * Expand a named route into a URL.
   *
   * An unknown name yields an `Error` **as the return value**, not a throw:
   * the original router let callers decide, and `redirect()` relies on it
   * (`if (source instanceof Error) throw source`).
   */
  url(name: string, ...args: unknown[]): string | Error {
    const layer = this.named.get(name)
    if (layer === undefined) return new Error(`sac-path-router: no route named "${name}"`)
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
   * A router configured for another host claims nothing: `routes()` hands such
   * a request straight on, and the fetch entry's "a claimed path is ours, so a
   * method nobody answers is a 405" rule must not fire for a router that never
   * looked at the request.
   *
   * @param path - the request path.
   * @param host - the request's host, when the caller knows it.
   * @returns true when a method-constrained layer's path matches.
   */
  claims(path: string, host?: string): boolean {
    if (host !== undefined && !this.matchHost(host)) return false
    return this.matcher.claims(path)
  }

  /** Dispatch one context through the matched layers, or call `next` when nothing matched. */
  routes(): (context: Context, next?: Next) => Promise<void> {
    const router = this
    return function dispatch(context: Context, next?: Next): Promise<void> {
      // Host gate: a router configured for another host passes the request on
      // untouched, exactly as the original did.
      if (!router.matchHost(context.host)) return next === undefined ? Promise.resolve() : next()
      const path = context.path
      const entries = router.matcher.matchRoute(path, context.method)
      context.appendMatched(() => router.matcher.matchPath(path))
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
          // Params are published on the request as well: middleware written
          // against the router this was extracted from reads `ctx.request.params`.
          Object.defineProperty(inner.request, 'params', {
            value: inner.params,
            configurable: true,
            writable: true,
          })
          inner.routePath = layer.path
          inner.routeName = layer.name
          // The underscored pair is the name that router published.
          inner._matchedRoute = layer.path
          if (layer.name !== null) inner._matchedRouteName = layer.name
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
   * Expand a path pattern into a URL without needing a registered route.
   *
   * The router this was extracted from exposed this as a static, so a pattern
   * could be expanded before anything registered it.
   *
   * @param path - the pattern to expand.
   * @param args - parameter values, positional or as one object.
   */
  static url(path: string, ...args: unknown[]): string {
    const scratch = new Layer<{ params: Record<string, string> }>(path, [], () => undefined)
    return scratch.url(...(args as [unknown]))
  }

  /**
   * Answer `source` with a redirect to `destination`.
   *
   * Either argument may be a route name instead of a path, and `destination`
   * may be an absolute URL. Default status is 301, as the original used. The
   * body is negotiated: HTML for a browser that asked for it, plain text
   * otherwise.
   */
  redirect(source: string, destination: string, code?: number): this {
    const from = source.startsWith('/') ? source : this.expandName(source)
    const to = destination.startsWith('/') || destination.includes('://')
      ? destination
      : this.expandName(destination)
    return this.all(from, (context: Context) => {
      context.responseHeaders.set('Location', encodeURI(to))
      context.status = code ?? 301
      const accept = context.request.headers.get('accept') ?? ''
      if (accept.includes('text/html')) {
        context.responseHeaders.set('Content-Type', 'text/html; charset=utf-8')
        context.body = `Redirecting to <a href="${escapeHtml(to)}">${escapeHtml(to)}</a>.`
        return
      }
      context.responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
      context.body = `Redirecting to ${to}.`
    })
  }

  /** A named route's URL; throws when the name is unknown (as `redirect` needs). */
  private expandName(name: string): string {
    const expanded = this.url(name)
    if (expanded instanceof Error) throw expanded
    return expanded
  }

  /** `routes()`, under the name @koa/router also exposes it as. */
  middleware(): (context: Context, next?: Next) => Promise<void> {
    return this.routes()
  }

  /**
   * Whether this router answers for `input` as a Host.
   *
   * A string compares for equality; a RegExp is tested. No `host` configured
   * means every host is this router's business. (The router this was extracted
   * from opened with a bare `return true`, so the rest of that function was
   * dead code — this implements the semantics it was clearly meant to have.)
   */
  matchHost(input: string | undefined): boolean {
    const { host } = this.settings
    if (host === undefined) return true
    if (input === undefined) return false
    if (typeof host === 'string') return input === host
    return host.test(input)
  }

  /**
   * Answer `OPTIONS`, `405`, and `501` for matched paths, in Koa's shape.
   *
   * @param options - `throw: true` throws instead of writing the status.
   */
  allowedMethods(options: AllowedMethodsOptions = {}): Middleware<Context> {
    // `settings.methods` lets a caller narrow or widen what counts as
    // implemented; the default is the full method table. Reading it here rather
    // than using the constant directly is what keeps the other nineteen verbs
    // from being answered with 501.
    const implemented = (this.settings.methods ?? HTTP_METHODS).map(method => method.toLowerCase())
    return async (context: Context, next: Next) => {
      await next()
      if (context.responded) return
      if (context.status !== 404) return
      const allowed = new Set<string>()
      for (const layer of context.matched) for (const method of layer.methods) allowed.add(method)
      const list = [...allowed].join(', ')
      if (!implemented.includes(context.method.toLowerCase())) {
        if (options.throw === true) throw options.notImplemented?.() ?? notImplemented()
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
        if (options.throw === true) throw options.methodNotAllowed?.() ?? methodNotAllowed()
        context.status = 405
        context.responseHeaders.set('Allow', list)
      }
    }
  }
}

/** Escape the five characters that matter inside HTML text and attributes. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Convenience factory, so callers need not use `new`. */
export function createRouter<Context extends RouterContext = RouterContext>(
  options?: RouterOptions,
): Router<Context> {
  return new Router<Context>(options)
}
