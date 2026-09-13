/**
 * The Express dialect's response builder: collects status and headers, then
 * materializes one web `Response` on the routing context.
 *
 * @module sac-path-router/express/response
 */

import { RouterContext } from '../core/context.js'
import type { ExpressResponse } from './types.js'

/** Statuses that must not carry a body. */
const BODYLESS = new Set([204, 205, 304])

/**
 * Express-shaped response writer over a routing context.
 *
 * Finishing (`json`, `send`, `end`, `redirect`, `sendStatus`) marks the routing
 * context as responded, which is what stops the fetch entry from reaching the
 * network.
 */
export class ResponseBuilder implements ExpressResponse {
  /** Status a response uses; defaults to 200. */
  statusCode = 200

  /** Whether a response was produced. */
  headersSent = false

  /** Per-response scratch space, as in Express. */
  locals: Record<string, unknown> = {}

  /**
   * @param context - routing context this response writes into.
   */
  constructor(private readonly context: RouterContext) {}

  /** Set the status code. */
  status(code: number): this {
    this.statusCode = code
    return this
  }

  /** Set one response header. */
  set(field: string, value: string): this {
    this.context.responseHeaders.set(field, value)
    return this
  }

  /** Alias of {@link set}. */
  header(field: string, value: string): this {
    return this.set(field, value)
  }

  /** Add one value to a response header. */
  append(field: string, value: string): this {
    this.context.responseHeaders.append(field, value)
    return this
  }

  /** Set the `Content-Type` header. */
  type(value: string): this {
    return this.set('content-type', value.includes('/') ? value : `${value}; charset=utf-8`)
  }

  /** Read one response header that was set. */
  get(field: string): string | null {
    return this.context.responseHeaders.get(field)
  }

  /** Send a JSON body. */
  json(body: unknown): this {
    if (!this.context.responseHeaders.has('content-type')) {
      this.context.responseHeaders.set('content-type', 'application/json; charset=utf-8')
    }
    return this.end(JSON.stringify(body))
  }

  /** Send a body: a string, bytes, JSON value, or nothing. */
  send(body?: unknown): this {
    if (body === undefined || body === null) return this.end(undefined)
    if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer
      || body instanceof ReadableStream || body instanceof URLSearchParams || body instanceof FormData
      || body instanceof Blob) {
      return this.end(body as BodyInit)
    }
    return this.json(body)
  }

  /** Finish the response. */
  end(body?: unknown): this {
    const status = this.statusCode
    const init: ResponseInit = { status, headers: this.context.responseHeaders }
    const payload = BODYLESS.has(status) || body === undefined || body === null
      ? null
      : (body as BodyInit)
    this.context.status = status
    this.context.respond(new Response(payload, init))
    this.headersSent = true
    return this
  }

  /** Redirect to `url`. */
  redirect(url: string, code = 302): this {
    this.statusCode = code
    this.context.responseHeaders.set('location', url)
    return this.end(undefined)
  }

  /** Finish the response with a status and no body. */
  sendStatus(code: number): this {
    this.statusCode = code
    return this.end(undefined)
  }
}
