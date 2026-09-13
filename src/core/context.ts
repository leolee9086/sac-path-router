/**
 * The routing context: one request, its mutable routing target, and the state a
 * middleware chain reads and rewrites.
 *
 * Everything here is a web standard (`Request`, `Headers`, `URL`), so the same
 * context works in a browser, in Node, and inside an in-process fetch
 * interceptor.
 *
 * @module sac-path-router/core/context
 */

/**
 * The matched-layer facts a context keeps. Structural rather than `Layer<Context>`
 * so a context of any router stays assignable across dialects.
 */
export interface MatchedLayer {
  readonly path: string
  readonly name: string | null
  readonly methods: readonly string[]
}

/**
 * Request-scoped facts a host may attach before routing, so routes and
 * middleware can match on them (`ctx.scope.provider`, `ctx.scope.sessionId`).
 */
export interface RouterScope {
  provider?: string
  model?: string
  sessionId?: string
  purpose?: string
  [key: string]: unknown
}

/** One routed request. */
export class RouterContext {
  /** The request exactly as it arrived. */
  readonly request: Request

  /** The outgoing target. Mutable: a middleware may rewrite it. */
  url: URL

  /** Outgoing method. Mutable. */
  method: string

  /** Outgoing request headers, detached from the incoming request. */
  readonly headers: Headers

  /** Response headers a local (non-network) route should send. */
  readonly responseHeaders: Headers = new Headers()

  /** Matched parameters of the current layer. */
  params: Record<string, string> = {}

  /** Raw captures of the current layer. */
  captures: string[] = []

  /** Host-owned per-request state; `scope` carries {@link RouterScope}. */
  state: Record<string, unknown> = {}

  /** Status a local response uses; defaults to 404, as in Koa. */
  status = 404

  /** Body a local route sets; a string, JSON value, or a `BodyInit`. */
  body: unknown

  /** Final response. Setting it short-circuits the chain and the network. */
  response?: Response

  /**
   * Every layer whose path matched, in registration order.
   *
   * Resolved on first read: collecting path matches is the expensive half of
   * matching (a scan in radix mode), and only `allowedMethods()` and the fetch
   * entry's claim check need it, so a plain route hit never pays for it.
   */
  get matched(): MatchedLayer[] {
    if (this.matchedProvider !== undefined) {
      this.matchedLayers = this.matchedProvider()
      this.matchedProvider = undefined
    }
    return this.matchedLayers
  }

  set matched(value: MatchedLayer[]) {
    this.matchedProvider = undefined
    this.matchedLayers = value
  }

  /**
   * Defer the matched-layer query until {@link matched} is read.
   *
   * @param provider - resolves the matched layers for this request.
   */
  setMatchedProvider(provider: () => MatchedLayer[]): void {
    this.matchedProvider = provider
    this.matchedLayers = []
  }

  /** Matched layers once resolved. */
  private matchedLayers: MatchedLayer[] = []

  /** Pending matched-layer query; cleared by the first read. */
  private matchedProvider?: () => MatchedLayer[]

  /** The router that dispatched this context. */
  router?: unknown

  /** Path of the most specific matched layer. */
  routePath?: string

  /** Name of the most specific matched layer, when it has one. */
  routeName?: string | null

  /** Set once a method-constrained route layer actually ran. */
  routed = false

  /** Set once a handler produced a response. */
  private complete = false

  /**
   * @param request - the request to route.
   */
  constructor(request: Request) {
    this.request = request
    this.url = new URL(request.url)
    this.method = request.method
    this.headers = new Headers(request.headers)
  }

  /** Routing target path. Assigning it makes the fetch entry re-dispatch. */
  get path(): string {
    return this.url.pathname
  }

  set path(value: string) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      this.url = new URL(value)
      return
    }
    const next = new URL(this.url)
    const [pathname, search] = value.split('?')
    next.pathname = pathname ?? '/'
    if (search !== undefined) next.search = `?${search}`
    this.url = next
  }

  /** Query parameters of the current target. */
  get query(): Record<string, string> {
    return Object.fromEntries(this.url.searchParams)
  }

  /** Alias kept for Koa-shaped middleware. */
  get req(): Request {
    return this.request
  }

  /** First value of one request header. */
  get(name: string): string | null {
    return this.headers.get(name)
  }

  /** Set an outgoing request header. */
  set(name: string, value: string): void {
    this.headers.set(name, value)
  }

  /** Host-attached scope, when one was provided. */
  get scope(): RouterScope | undefined {
    return this.state['scope'] as RouterScope | undefined
  }

  set scope(value: RouterScope | undefined) {
    this.state['scope'] = value
  }

  /** Mark a local response as produced, so the network is never consulted. */
  respond(response: Response): Response {
    this.response = response
    this.complete = true
    return response
  }

  /** Whether a handler already produced the response. */
  get responded(): boolean {
    return this.complete || this.response !== undefined
  }
}

/**
 * Build the routing context for one request.
 *
 * @param request - the request to route.
 * @returns a context whose headers are detached from `request`.
 */
export function createContext(request: Request): RouterContext {
  return new RouterContext(request)
}
