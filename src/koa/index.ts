/**
 * Koa dialect: the context-shaped router from the core, plus a small
 * application that owns global middleware and exposes itself as a fetch entry.
 *
 * @module sac-path-router/koa
 */

import { compose, type Middleware, type Next } from '../core/compose.js'
import { RouterContext, createContext } from '../core/context.js'
import { createFetchEntry, type FetchEntry, type FetchEntryOptions } from '../core/fetch-entry.js'
import { Router, createRouter, type RouterOptions, type UseArgument } from '../core/router.js'
import { KoaContext, createKoaContext } from './context.js'

export { KoaContext, createKoaContext } from './context.js'

export { Router, createRouter } from '../core/router.js'
export { RouterContext, createContext } from '../core/context.js'
export { compose } from '../core/compose.js'
export { createFetchEntry } from '../core/fetch-entry.js'
export type { Middleware, Next } from '../core/compose.js'
export type { RouterOptions } from '../core/router.js'

/**
 * An application: global middleware in front of one router.
 *
 * `app.use(handler)` runs before routing for every request; `app.get(...)` and
 * friends register routes; `app.fetch()` turns the whole thing into a `fetch`
 * function, and `app.handler()` into a plain request handler for a server.
 */
/** Options an application takes on top of the router's own. */
export interface ApplicationOptions extends RouterOptions {
  /** Trust `X-Forwarded-*` headers. Defaults to false. */
  proxy?: boolean
  /** How many trailing labels are the app's own domain. Defaults to 2. */
  subdomainOffset?: number
  /** Header carrying the forwarded client address. Defaults to `X-Forwarded-For`. */
  proxyIpHeader?: string
  /** Cap on how many forwarded addresses to keep; 0 means all. */
  maxIpsCount?: number
  /** Environment name; defaults to `NODE_ENV` or 'development'. */
  env?: string
  /** Keys for signed cookies. */
  keys?: string[]
  /** Optional logger, surfaced to middleware that wants one. */
  logger?: unknown
}

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
export class Application<Context extends RouterContext = KoaContext> {
  /** Layers and routes, in registration order. */
  readonly router: Router<Context>

  /** Middleware registered with `app.use(handler)` before any route. */
  readonly middleware: Middleware<Context>[] = []

  /** Trust `X-Forwarded-*` headers. */
  readonly proxy: boolean

  /** How many trailing labels are the app's own domain. */
  readonly subdomainOffset: number

  /** Header carrying the forwarded client address. */
  readonly proxyIpHeader: string

  /** Cap on how many forwarded addresses to keep. */
  readonly maxIpsCount: number

  /** Environment name. */
  readonly env: string

  /** Keys for signed cookies, when the host supplied any. */
  readonly keys: string[] | undefined

  /** Optional logger, surfaced to middleware that wants one. */
  readonly logger: unknown

  /** Listeners registered through `on()`. */
  private readonly listeners = new Map<string, ((...args: unknown[]) => void)[]>()

  /**
   * @param options - router options plus the application-level settings.
   */
  constructor(options: ApplicationOptions = {}) {
    this.router = new Router<Context>(options)
    this.proxy = options.proxy ?? false
    this.subdomainOffset = options.subdomainOffset ?? 2
    this.proxyIpHeader = options.proxyIpHeader ?? 'X-Forwarded-For'
    this.maxIpsCount = options.maxIpsCount ?? 0
    this.env = options.env ?? 'development'
    this.keys = options.keys
    this.logger = options.logger
  }

  /** Listen for `event`; returns a function that removes the listener. */
  on(event: string, listener: (...args: unknown[]) => void): () => void {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
    return () => this.off(event, listener)
  }

  /** Remove one listener. */
  off(event: string, listener: (...args: unknown[]) => void): void {
    const list = this.listeners.get(event)
    if (list === undefined) return
    const at = list.indexOf(listener)
    if (at !== -1) list.splice(at, 1)
  }

  /** Emit `event` to every listener. */
  emit(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args)
  }

  /** Register global middleware (no path), a path-scoped middleware, or a mounted router. */
  use(...args: UseArgument<Context>[]): this {
    this.router.use(...args)
    return this
  }

  /** Route `GET` (and `HEAD`). */
  get(path: string, ...mw: Middleware<Context>[]): this { this.router.get(path, ...mw); return this }
  /** Route `POST`. */
  post(path: string, ...mw: Middleware<Context>[]): this { this.router.post(path, ...mw); return this }
  /** Route `PUT`. */
  put(path: string, ...mw: Middleware<Context>[]): this { this.router.put(path, ...mw); return this }
  /** Route `PATCH`. */
  patch(path: string, ...mw: Middleware<Context>[]): this { this.router.patch(path, ...mw); return this }
  /** Route `DELETE`. */
  delete(path: string, ...mw: Middleware<Context>[]): this { this.router.delete(path, ...mw); return this }
  /** Route `DELETE`; the alias the router also exposes. */
  del(path: string, ...mw: Middleware<Context>[]): this { this.router.del(path, ...mw); return this }
  /** Route `HEAD`. */
  head(path: string, ...mw: Middleware<Context>[]): this { this.router.head(path, ...mw); return this }
  /** Route `OPTIONS`. */
  options(path: string, ...mw: Middleware<Context>[]): this { this.router.options(path, ...mw); return this }
  /** Route `TRACE`. */
  trace(path: string, ...mw: Middleware<Context>[]): this { this.router.trace(path, ...mw); return this }
  /** Route `COPY`. */
  copy(path: string, ...mw: Middleware<Context>[]): this { this.router.copy(path, ...mw); return this }
  /** Route `LOCK`. */
  lock(path: string, ...mw: Middleware<Context>[]): this { this.router.lock(path, ...mw); return this }
  /** Route `MKCOL`. */
  mkcol(path: string, ...mw: Middleware<Context>[]): this { this.router.mkcol(path, ...mw); return this }
  /** Route `MOVE`. */
  move(path: string, ...mw: Middleware<Context>[]): this { this.router.move(path, ...mw); return this }
  /** Route `PURGE`. */
  purge(path: string, ...mw: Middleware<Context>[]): this { this.router.purge(path, ...mw); return this }
  /** Route `PROPFIND`. */
  propfind(path: string, ...mw: Middleware<Context>[]): this { this.router.propfind(path, ...mw); return this }
  /** Route `PROPPATCH`. */
  proppatch(path: string, ...mw: Middleware<Context>[]): this { this.router.proppatch(path, ...mw); return this }
  /** Route `UNLOCK`. */
  unlock(path: string, ...mw: Middleware<Context>[]): this { this.router.unlock(path, ...mw); return this }
  /** Route `REPORT`. */
  report(path: string, ...mw: Middleware<Context>[]): this { this.router.report(path, ...mw); return this }
  /** Route `MKACTIVITY`. */
  mkactivity(path: string, ...mw: Middleware<Context>[]): this { this.router.mkactivity(path, ...mw); return this }
  /** Route `CHECKOUT`. */
  checkout(path: string, ...mw: Middleware<Context>[]): this { this.router.checkout(path, ...mw); return this }
  /** Route `MERGE`. */
  merge(path: string, ...mw: Middleware<Context>[]): this { this.router.merge(path, ...mw); return this }
  /** Route `M-SEARCH`; the one verb whose name is not an identifier. */
  'm-search'(path: string, ...mw: Middleware<Context>[]): this { this.router['m-search'](path, ...mw); return this }
  /** Route `NOTIFY`. */
  notify(path: string, ...mw: Middleware<Context>[]): this { this.router.notify(path, ...mw); return this }
  /** Route `SUBSCRIBE`. */
  subscribe(path: string, ...mw: Middleware<Context>[]): this { this.router.subscribe(path, ...mw); return this }
  /** Route `UNSUBSCRIBE`. */
  unsubscribe(path: string, ...mw: Middleware<Context>[]): this { this.router.unsubscribe(path, ...mw); return this }
  /** Route `SEARCH`. */
  search(path: string, ...mw: Middleware<Context>[]): this { this.router.search(path, ...mw); return this }
  /** Route `CONNECT`. */
  connect(path: string, ...mw: Middleware<Context>[]): this { this.router.connect(path, ...mw); return this }
  /** Route every method. */
  all(path: string, ...mw: Middleware<Context>[]): this { this.router.all(path, ...mw); return this }

  /** Register several routes under one prefix. */
  group(path: string, configure: (router: Router<Context>) => void): this {
    this.router.group(path, configure)
    return this
  }

  /** Answer `OPTIONS`, `405`, and `501` for paths this application handles. */
  allowedMethods(options: { throw?: boolean } = {}): Middleware<Context> {
    return this.router.allowedMethods(options)
  }

  /** The routing middleware, for mounting inside another application or router. */
  routes(): (context: Context, next?: Next) => Promise<void> {
    return this.router.routes()
  }

  /** A bare request handler: one context in, nothing out but the context's response. */
  handler(): (context: Context, next?: Next) => Promise<void> {
    const run = this.routes()
    return (context: Context, next?: Next) => run(context, next)
  }

  /**
   * Turn this application into a routed `fetch`.
   *
   * @param options - entry options; `router` is supplied by the application.
   */
  fetch(options: Omit<FetchEntryOptions<Context>, 'router'> = {}): FetchEntry {
    // The Koa context is the default here: middleware written for Koa reaches
    // for `ctx.throw`, `ctx.accepts` and friends, and none of that exists on the
    // core context. A caller may still supply its own factory.
    const supplied = options.createContext
    const settings = {
      proxy: this.proxy,
      subdomainOffset: this.subdomainOffset,
      proxyIpHeader: this.proxyIpHeader,
      maxIpsCount: this.maxIpsCount,
    }
    const createContextOption = (request: Request): Context => {
      const context = supplied === undefined
        ? (createKoaContext(request) as unknown as Context)
        : supplied(request)
      // The application's settings reach the context, which is where `ips`,
      // `protocol` and `subdomains` read them.
      ;(context as unknown as { appOptions?: unknown }).appOptions = settings
      ;(context as unknown as { app?: unknown }).app = this
      return context
    }
    return createFetchEntry<Context>({ ...options, createContext: createContextOption, router: this.router })
  }

  /**
   * A plain request handler: one web `Request` in, one web `Response` out.
   *
   * This is what a server adapter mounts. Nothing here touches a socket, which
   * is why it works the same in a browser and under `node:http`.
   */
  callback(): (request: Request) => Promise<Response> {
    const run = this.fetch()
    return request => run(request)
  }

  /** The settings worth printing, mirroring Koa's `toJSON`. */
  toJSON(): Record<string, unknown> {
    return {
      subdomainOffset: this.subdomainOffset,
      proxy: this.proxy,
      env: this.env,
    }
  }

  /** `inspect` alias, so logging an application prints its settings. */
  inspect(): Record<string, unknown> {
    return this.toJSON()
  }

  /** Compose an ad-hoc middleware chain in front of this application's routes. */
  compose(...middleware: Middleware<Context>[]): (context: Context, next?: Next) => Promise<void> {
    return compose([...middleware, this.routes() as Middleware<Context>])
  }
}

/** Convenience factory, mirroring {@link createRouter}. */
export function createApp<Context extends RouterContext = RouterContext>(
  options?: RouterOptions,
): Application<Context> {
  return new Application<Context>(options)
}
