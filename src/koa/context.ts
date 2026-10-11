/**
 * Koa dialect: the context shape middleware written for Koa expects.
 *
 * The reference router this was extracted from shipped a full Koa context,
 * request, and response. A router in front of `fetch` needs all of it, because
 * middleware in the wild reaches for `ctx.throw`, `ctx.accepts`, `ctx.redirect`,
 * `ctx.attachment` and the rest — the auth middleware in that very codebase
 * calls `ctx.throw(401, ...)`.
 *
 * Two names had to move, because this router's `ctx` is a **fetch** context
 * first:
 *
 * | Koa | here |
 * |---|---|
 * | `ctx.set/get` (response headers) | `ctx.set/get` — kept as Koa means them |
 * | (outgoing request headers) | `ctx.setRequestHeader` / `ctx.getRequestHeader` |
 * | `ctx.request` (a Koa request) | `ctx.request` is the web `Request`; the Koa
 *   accessors live directly on the context, which is what Koa's own delegation
 *   does anyway |
 * | `ctx.request.body` | `ctx.requestBody` (the outgoing body) |
 *
 * @module sac-path-router/koa/context
 */

import { HttpError, createError } from '../core/errors.js'
import { RouterContext } from '../core/context.js'

/** Status codes whose responses carry no body. */
const EMPTY_STATUS = new Set([204, 205, 304])

/** Status codes that are redirects. */
const REDIRECT_STATUS = new Set([301, 302, 303, 305, 307, 308])

/**
 * A Koa-shaped context over the core one.
 *
 * Everything Koa delegates from `ctx` to `ctx.request` / `ctx.response` is
 * defined here directly, since the core keeps those two as web-standard objects.
 */
export class KoaContext extends RouterContext {
  /** Guards `assert` and the response setters. */
  private explicitStatus = false

  /** Response status text, when it was set explicitly. */
  private statusMessage: string | undefined

  // ----------------------------------------------------------- error helpers

  /**
   * Throw when `test` is falsy, the way Koa's `ctx.assert` does.
   *
   * @param test - value to test.
   * @param status - status for the thrown error.
   * @param message - message for the thrown error.
   */
  assert(test: unknown, status = 500, message?: string): asserts test {
    if (!test) throw createError(status, message)
  }

  /**
   * Throw an HTTP error. Accepts the same argument shapes as http-errors:
   * `(403)`, `(400, 'bad')`, `(400, new Error('bad'))`, `('bad')`, `(error)`.
   */
  throw(...args: unknown[]): never {
    throw createError(...args)
  }

  /**
   * Default error handling: report, then answer with the error's status.
   *
   * 5xx messages are not echoed back unless the error says they may be.
   */
  onerror(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error))
    const status = err instanceof HttpError ? err.status : 500
    const expose = err instanceof HttpError ? err.expose : false
    this.status = status
    this.body = expose ? err.message : 'Internal Server Error'
    // Koa gives the application a chance to log or count it; error middleware in
    // the reference codebase listened on exactly this event.
    this.app?.emit('error', err, err.stack, this)
  }

  /**
   * The application this context belongs to, when one was given.
   *
   * Set by `Application.fetch()`. `onerror` emits through it, and middleware can
   * read `ctx.app.env` and friends.
   */
  app: { emit(event: string, ...args: unknown[]): void } | undefined

  // ------------------------------------------------------- response setters

  /**
   * Set the response status, remembering that it was chosen explicitly.
   *
   * Validation lives in the core context's `status` accessor, so this only adds
   * the bookkeeping Koa needs: a route that set a status but no body should not
   * have that status overwritten by the body-defaulting rule.
   */
  setStatus(code: number): void {
    this.status = code
    this.explicitStatus = true
  }

  /** Whether the status was set explicitly rather than inferred from a body. */
  get hasExplicitStatus(): boolean {
    return this.explicitStatus
  }

  // ---------------------------------------------------------- header helpers

  /**
   * Set a response header; an object sets several at once.
   *
   * This is Koa's meaning. The core's `set` writes an **outgoing request**
   * header, which is this router's own concern; that is now `setRequestHeader`.
   */
  override set(field: string | Record<string, string>, value?: string): void {
    if (typeof field === 'string') {
      if (value === undefined) return
      this.responseHeaders.set(field, value)
      return
    }
    for (const [name, one] of Object.entries(field)) this.responseHeaders.set(name, one)
  }

  /** One response header, or '' when it is not set. */
  override get(field: string): string {
    return this.responseHeaders.get(field) ?? ''
  }

  /** Whether a response header is set. */
  has(field: string): boolean {
    return this.responseHeaders.has(field)
  }

  /** Append to a response header, keeping what is there. */
  append(field: string, value: string | string[]): void {
    for (const one of Array.isArray(value) ? value : [value]) {
      this.responseHeaders.append(field, one)
    }
  }

  /** Remove a response header. */
  remove(field: string): void {
    this.responseHeaders.delete(field)
  }

  /** Set an **outgoing request** header (this router's own addition). */
  setRequestHeader(field: string, value: string): void {
    this.headers.set(field, value)
  }

  /** One **outgoing request** header, or null. */
  getRequestHeader(field: string): string | null {
    return this.headers.get(field)
  }

  // ------------------------------------------------------- content helpers

  /** Response `Content-Type` without parameters. */
  get type(): string {
    const type = this.responseHeaders.get('content-type')
    return type === null ? '' : type.split(';', 1)[0] as string
  }

  /** Set `Content-Type`. */
  set type(value: string) {
    if (value === '') this.responseHeaders.delete('Content-Type')
    else this.responseHeaders.set('Content-Type', value)
  }

  /** Response `ETag`, normalizing the quotes. */
  get etag(): string {
    return this.responseHeaders.get('etag') ?? ''
  }

  /** Set `ETag`, adding quotes when they are missing. */
  set etag(value: string) {
    this.responseHeaders.set('ETag', /^(W\/)?"/.test(value) ? value : `"${value}"`)
  }

  /** Response `Last-Modified` as a Date, when present. */
  get lastModified(): Date | undefined {
    const value = this.responseHeaders.get('last-modified')
    return value === null ? undefined : new Date(value)
  }

  /** Set `Last-Modified` from a Date or a parseable string. */
  set lastModified(value: Date | string) {
    const date = typeof value === 'string' ? new Date(value) : value
    this.responseHeaders.set('Last-Modified', date.toUTCString())
  }

  /** Whether a body has been written to a response that is already closed. */
  get headerSent(): boolean {
    return this.response !== undefined
  }

  /**
   * Redirect to `url`, the way Koa's `ctx.redirect` does.
   *
   * `'back'` follows the Referer (or `alt`), the body is negotiated between HTML
   * and text, and the status defaults to 302 when the current one is not already
   * a redirect.
   */
  redirect(url: string, alt?: string): void {
    const target = url === 'back'
      ? (this.request.headers.get('referer') ?? alt ?? '/')
      : url
    this.responseHeaders.set('Location', encodeURI(target))
    if (!REDIRECT_STATUS.has(this.status)) this.status = 302
    const accept = this.request.headers.get('accept') ?? ''
    if (accept.includes('text/html')) {
      this.type = 'text/html; charset=utf-8'
      this.body = `Redirecting to <a href="${escapeHtml(target)}">${escapeHtml(target)}</a>.`
      return
    }
    this.type = 'text/plain; charset=utf-8'
    this.body = `Redirecting to ${target}.`
  }

  /** Set `Content-Disposition: attachment`, optionally with a filename. */
  attachment(filename?: string): void {
    const base = filename === undefined ? 'attachment' : filename.split(/[\\/]/).pop() ?? filename
    const value = filename === undefined ? 'attachment' : `attachment; filename="${base.replace(/"/g, '')}"`
    this.responseHeaders.set('Content-Disposition', value)
  }

  /** Vary on `field`, appending to any existing `Vary`. */
  vary(field: string): void {
    const current = this.responseHeaders.get('vary')
    if (current === null) {
      this.responseHeaders.set('Vary', field)
      return
    }
    if (current.split(/\s*,\s*/).includes(field)) return
    this.responseHeaders.set('Vary', `${current}, ${field}`)
  }

  // ------------------------------------------------- request-shape getters

  /** Raw query string, without the leading `?`. */
  get querystring(): string {
    return this.url.search.replace(/^\?/, '')
  }

  /** Set the query string (no leading `?` needed). */
  set querystring(value: string) {
    this.url = new URL(this.url.origin + this.url.pathname + (value === '' ? '' : `?${value.replace(/^\?/, '')}`))
  }

  /** Query string with the leading `?`, or '' when there is none. */
  get search(): string {
    return this.url.search
  }

  /** Set the search string; a leading `?` is optional. */
  set search(value: string) {
    this.querystring = value
  }

  /** `scheme://host` of the current target. */
  get origin(): string {
    return this.url.origin
  }

  /** Full request URL as a string. */
  get href(): string {
    return this.url.href
  }

  /** The target as a WHATWG `URL`. */
  get URL(): URL {
    return this.url
  }

  /** Host without the port. */
  get hostname(): string {
    return this.url.hostname
  }

  /**
   * Labels before the app's own domain, reversed as Koa returns them.
   *
   * `tobi.ferrets.example.com` with the default offset of 2 gives
   * `['ferrets', 'tobi']`. An IP host has no subdomains.
   */
  get subdomains(): string[] {
    const offset = this.appOptions?.subdomainOffset ?? 2
    const hostname = this.hostname
    if (hostname === '' || isIpAddress(hostname)) return []
    return hostname.split('.').reverse().slice(offset)
  }

  /** Application settings this context was given, when any. */
  appOptions: { proxy?: boolean; subdomainOffset?: number; proxyIpHeader?: string; maxIpsCount?: number } | undefined

  /**
   * Forwarded client addresses, nearest first, when the app trusts a proxy.
   *
   * @returns the addresses, capped by `maxIpsCount` when one is set.
   */
  get ips(): string[] {
    const options = this.appOptions
    if (options?.proxy !== true) return []
    const header = this.request.headers.get((options.proxyIpHeader ?? 'X-Forwarded-For').toLowerCase())
    if (header === null || header === '') return []
    const list = header.split(/\s*,\s*/)
    const cap = options.maxIpsCount ?? 0
    return cap > 0 ? list.slice(-cap) : list
  }

  /** Client address: the first forwarded one, or the host's own. */
  get ip(): string {
    return this.ips[0] ?? ''
  }

  /** `https` when the target says so, honoring `X-Forwarded-Proto` behind a proxy. */
  get protocol(): string {
    if (this.appOptions?.proxy === true) {
      const forwarded = this.request.headers.get('x-forwarded-proto')
      if (forwarded !== null && forwarded !== '') return forwarded.split(/\s*,\s*/)[0] ?? 'http'
    }
    return this.url.protocol.replace(':', '')
  }

  /** Whether the request arrived over TLS. */
  get secure(): boolean {
    return this.protocol === 'https'
  }

  /** Whether the request is idempotent by method. */
  get idempotent(): boolean {
    return ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'].includes(this.method)
  }

  /** Charset named by the request `Content-Type`, or ''. */
  get charset(): string {
    const contentType = this.request.headers.get('content-type') ?? ''
    const match = /charset=([^;\s]+)/i.exec(contentType)
    return match?.[1] ?? ''
  }

  /** Declared request body length, or undefined. */
  get requestLength(): number | undefined {
    const value = this.request.headers.get('content-length')
    if (value === null || value === '') return undefined
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  /** Request `Content-Type` without parameters. */
  get requestType(): string {
    const contentType = this.request.headers.get('content-type')
    return contentType === null ? '' : contentType.split(';', 1)[0] as string
  }

  /**
   * Whether a conditional request may be answered with 304.
   *
   * True when the method is GET or HEAD, the status is 2xx or 304, and the
   * request's `If-None-Match` / `If-Modified-Since` still match the response's
   * `ETag` / `Last-Modified`.
   */
  get fresh(): boolean {
    if (this.method !== 'GET' && this.method !== 'HEAD') return false
    if (!((this.status >= 200 && this.status < 300) || this.status === 304)) return false
    const noneMatch = this.request.headers.get('if-none-match')
    const etag = this.responseHeaders.get('etag')
    if (noneMatch !== null && etag !== null) return noneMatch === etag || noneMatch === '*'
    const since = this.request.headers.get('if-modified-since')
    const modified = this.responseHeaders.get('last-modified')
    if (since !== null && modified !== null) {
      return new Date(modified).getTime() <= new Date(since).getTime()
    }
    return false
  }

  /** Whether a conditional request must be answered in full. */
  get stale(): boolean {
    return !this.fresh
  }

  // -------------------------------------------------------- response shape

  /** Response status message, when one was set. */
  get message(): string {
    return this.statusMessage ?? ''
  }

  /** Set the response status message. */
  set message(value: string) {
    this.statusMessage = value
  }

  /** Response body length in bytes, derived from the body when not set. */
  get length(): number | undefined {
    const declared = this.responseHeaders.get('content-length')
    if (declared !== null) return Number.parseInt(declared, 10)
    const body = this.body
    if (body === undefined || body === null) return undefined
    if (typeof body === 'string') return byteLength(body)
    if (body instanceof Uint8Array) return body.byteLength
    try {
      return byteLength(JSON.stringify(body))
    } catch {
      return undefined
    }
  }

  /** Set `Content-Length`. */
  set length(value: number) {
    if (!this.responseHeaders.has('transfer-encoding')) this.responseHeaders.set('Content-Length', String(value))
  }

  /** Whether the response can still be written to. */
  get writable(): boolean {
    return this.response === undefined
  }

  /** Present for Koa parity; this router has no socket to flush. */
  flushHeaders(): void {
    // Nothing to do: the response is materialized in one piece by the fetch
    // entry, so there is no header buffer waiting to be sent.
  }

  // ---------------------------------------------------------------- cookies

  /** Backing field of {@link cookies}. */
  private cookieJar: CookieJar | undefined

  /**
   * Request cookies, readable and settable.
   *
   * Reading parses the request's `Cookie` header; assigning a name queues a
   * `Set-Cookie` on the response. Deliberately minimal — no signing, no
   * encryption — because a router should not silently decide a security policy.
   */
  get cookies(): CookieJar {
    this.cookieJar ??= new CookieJar(this)
    return this.cookieJar
  }

  // ------------------------------------------------------------ negotiation

  /** Request `Accept` header, for the content-negotiation helpers below. */
  private acceptHeader(): string {
    return this.request.headers.get('accept') ?? '*/*'
  }

  /**
   * Best match among `types` against the request's `Accept`.
   *
   * @returns the matching type, an array of matches when given an array, or false.
   */
  accepts(...types: (string | string[])[]): string | string[] | false {
    const flat = types.flat()
    const accept = this.acceptHeader()
    if (flat.length === 0) return accept.split(/\s*,\s*/)
    const wanted = flat.map(one => (one.includes('/') ? one : extensionToType(one)))
    const offered = accept.split(/\s*,\s*/).map(part => part.split(';')[0]?.trim() ?? '')
    const hits = wanted.filter(one => offered.some(have => matchesType(have, one)))
    if (hits.length === 0) return false
    return Array.isArray(types[0]) ? hits : hits[0] as string
  }

  /** Best match among `charsets` against `Accept-Charset`. */
  acceptsCharsets(...charsets: (string | string[])[]): string | string[] | false {
    const flat = charsets.flat()
    const header = this.request.headers.get('accept-charset') ?? '*'
    if (flat.length === 0) return header.split(/\s*,\s*/)
    const hits = flat.filter(one => header.includes('*') || header.includes(one))
    if (hits.length === 0) return false
    return Array.isArray(charsets[0]) ? hits : hits[0] as string
  }

  /** Best match among `encodings` against `Accept-Encoding`. */
  acceptsEncodings(...encodings: (string | string[])[]): string | string[] | false {
    const flat = encodings.flat()
    const header = this.request.headers.get('accept-encoding') ?? 'identity'
    if (flat.length === 0) return header.split(/\s*,\s*/)
    const hits = flat.filter(one => header.includes('*') || header.includes(one))
    if (hits.length === 0) return false
    return Array.isArray(encodings[0]) ? hits : hits[0] as string
  }

  /** Best match among `languages` against `Accept-Language`. */
  acceptsLanguages(...languages: (string | string[])[]): string | string[] | false {
    const flat = languages.flat()
    const header = this.request.headers.get('accept-language') ?? '*'
    if (flat.length === 0) return header.split(/\s*,\s*/)
    const hits = flat.filter(one => header.includes('*') || header.toLowerCase().includes(one.toLowerCase()))
    if (hits.length === 0) return false
    return Array.isArray(languages[0]) ? hits : hits[0] as string
  }

  /** Whether the request `Content-Type` is one of `types`. */
  is(...types: (string | string[])[]): string | false | null {
    const contentType = this.request.headers.get('content-type')
    if (contentType === null) return null
    const have = contentType.split(';')[0]?.trim() ?? ''
    const flat = types.flat().map(one => (one.includes('/') ? one : extensionToType(one)))
    const hit = flat.find(one => matchesType(have, one))
    return hit ?? false
  }
}

/** A handful of extensions Koa's `accepts` understands. */
function extensionToType(value: string): string {
  const table: Record<string, string> = {
    html: 'text/html', text: 'text/plain', txt: 'text/plain', json: 'application/json',
    js: 'application/javascript', css: 'text/css', xml: 'application/xml', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml',
    pdf: 'application/pdf', form: 'application/x-www-form-urlencoded',
  }
  return table[value] ?? value
}

/**
 * Whether the client's `offered` type accepts the `wanted` one.
 *
 * The wildcard is the **client's**: `Accept: *\/*` accepts anything we offer, so
 * a `*` on the offered side matches whatever `wanted` names. (A `*` on the
 * wanted side also matches, which is what makes `accepts('*')` work.)
 */
function matchesType(offered: string, wanted: string): boolean {
  if (offered === wanted) return true
  const [offerMain, offerSub] = offered.split('/')
  const [wantMain, wantSub] = wanted.split('/')
  const mainOk = offerMain === '*' || wantMain === '*' || offerMain === wantMain
  const subOk = offerSub === '*' || wantSub === '*' || offerSub === wantSub
  return mainOk && subOk
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

/** Options one response cookie takes. */
export interface CookieOptions {
  /** `Path` attribute; defaults to '/'. */
  path?: string
  /** `Max-Age` in seconds. */
  maxAge?: number
  /** Add `Secure`. */
  secure?: boolean
  /** Add `HttpOnly`; defaults to true, as that is the safe default. */
  httpOnly?: boolean
  /** `SameSite` attribute. */
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/**
 * A minimal cookie jar over one context.
 *
 * Reading parses the request's `Cookie` header; assigning queues a `Set-Cookie`
 * on the response. Signing and encryption are deliberately absent: a router
 * should not pick a security policy on the caller's behalf.
 */
export class CookieJar {
  /** The context this jar reads from and writes to. */
  private readonly context: KoaContext

  /** Parsed request cookies, computed once. */
  private parsed: Map<string, string> | undefined

  /**
   * @param context - the context whose request and response this jar uses.
   */
  constructor(context: KoaContext) {
    this.context = context
  }

  /** Every request cookie, as name → value. */
  get all(): Record<string, string> {
    return Object.fromEntries(this.entries())
  }

  /** One request cookie, or undefined. */
  get(name: string): string | undefined {
    return this.entries().get(name)
  }

  /**
   * Queue a response cookie.
   *
   * @param name - cookie name.
   * @param value - cookie value.
   * @param options - path, maxAge, secure, httpOnly, sameSite.
   */
  set(name: string, value: string, options: CookieOptions = {}): void {
    const parts = [`${name}=${encodeURIComponent(value)}`]
    parts.push(`Path=${options.path ?? '/'}`)
    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
    if (options.httpOnly !== false) parts.push('HttpOnly')
    if (options.secure === true) parts.push('Secure')
    if (options.sameSite !== undefined) parts.push(`SameSite=${options.sameSite}`)
    this.context.responseHeaders.append('Set-Cookie', parts.join('; '))
  }

  /** Queue a cookie for deletion. */
  delete(name: string, options: CookieOptions = {}): void {
    this.set(name, '', { ...options, maxAge: 0 })
  }

  /** Lazily parsed request cookies. */
  private entries(): Map<string, string> {
    if (this.parsed !== undefined) return this.parsed
    const jar = new Map<string, string>()
    const header = this.context.request.headers.get('cookie')
    if (header !== null) {
      for (const part of header.split(';')) {
        const at = part.indexOf('=')
        if (at === -1) continue
        const key = part.slice(0, at).trim()
        if (key === '') continue
        const raw = part.slice(at + 1).trim()
        try {
          jar.set(key, decodeURIComponent(raw))
        } catch {
          jar.set(key, raw)
        }
      }
    }
    this.parsed = jar
    return jar
  }
}

/** Whether a host string is a bare IP address (v4 or bracketed v6). */
function isIpAddress(hostname: string): boolean {
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts.every(part => /^\d+$/.test(part) && Number(part) <= 255)
}

/** UTF-8 byte length, without pulling in a Buffer polyfill. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

/** Build a Koa-shaped context for one request. */
export function createKoaContext(request: Request): KoaContext {
  return new KoaContext(request)
}
