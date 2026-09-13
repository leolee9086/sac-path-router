/**
 * The Express dialect's public types.
 *
 * @module sac-path-router/express/types
 */

/**
 * A routing request in Express' shape: a web `Request` plus the routing facts
 * Express handlers read. `path` and `query` are live views of the routing
 * context, so rewriting the target is visible here and re-dispatches.
 */
export interface ExpressRequest extends Request {
  /** Parameters captured by the matched layer. */
  params: Record<string, string>
  /** Query parameters of the current target. */
  query: Record<string, string>
  /** Path relative to the innermost mounted router. */
  path: string
  /** Path as it arrived. */
  originalUrl: string
  /** Bytes of path consumed by mounted routers; managed by the router. */
  mountOffset: number
  /** Parameter handlers already run for this request, keyed by name and value. */
  paramCache?: Set<string>
  /** First value of one request header. */
  get(name: string): string | null
  /** Alias of {@link ExpressRequest.get}. */
  header(name: string): string | null
}

/** The response builder Express handlers write to. */
export interface ExpressResponse {
  /** Status a response uses; defaults to 200. */
  statusCode: number
  /** Whether a response was produced; once true, the network is never consulted. */
  headersSent: boolean
  /** Per-response scratch space, as in Express. */
  locals: Record<string, unknown>
  /** Set the status code. */
  status(code: number): this
  /** Set one response header. */
  set(field: string, value: string): this
  /** Alias of {@link ExpressResponse.set}. */
  header(field: string, value: string): this
  /** Add one value to a response header. */
  append(field: string, value: string): this
  /** Set the `Content-Type` header. */
  type(value: string): this
  /** Read one response header that was set. */
  get(field: string): string | null
  /** Send a JSON body. */
  json(body: unknown): this
  /** Send a body: a string, bytes, JSON value, or nothing. */
  send(body?: unknown): this
  /** Finish the response. */
  end(body?: unknown): this
  /** Redirect to `url`. */
  redirect(url: string, code?: number): this
  /** Finish the response with a status and no body. */
  sendStatus(code: number): this
  /** Set one cookie. */
  cookie(name: string, value: string, options?: CookieOptions): this
  /** Expire one cookie. */
  clearCookie(name: string, options?: CookieOptions): this
  /** Vary the response on one request header. */
  vary(field: string): this
  /** Add `Link` headers for one resource map. */
  links(links: Record<string, string>): this
  /** Answer with the first representation the request accepts; 406 when none does. */
  format(types: Record<string, () => unknown>): this
}

/** Cookie attributes a response builder serializes. */
export interface CookieOptions {
  /** Lifetime in milliseconds. */
  maxAge?: number
  /** Cookie domain. */
  domain?: string
  /** Cookie path. */
  path?: string
  /** Absolute expiry. */
  expires?: Date
  /** Forbid script access. */
  httpOnly?: boolean
  /** Send only over HTTPS; implied by `sameSite: 'none'`. */
  secure?: boolean
  /** Cross-site policy. */
  sameSite?: boolean | 'lax' | 'strict' | 'none'
}

/** A request handler. */
export type ExpressHandler = (
  request: ExpressRequest,
  response: ExpressResponse,
  next: (error?: unknown) => unknown,
) => unknown

/** An error handler: four parameters, as in Express. */
export type ExpressErrorHandler = (
  error: unknown,
  request: ExpressRequest,
  response: ExpressResponse,
  next: (error?: unknown) => unknown,
) => unknown

/** Router options. */
export interface ExpressRouterOptions {
  /** Case-sensitive path matching; defaults to false, as in Express. */
  caseSensitive?: boolean
  /** Require the trailing slash; defaults to false. */
  strict?: boolean
  /** Internal: `false` turns a layer into a prefix mount. */
  strictEnd?: boolean
}
