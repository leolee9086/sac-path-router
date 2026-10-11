/**
 * HTTP errors: the shape `ctx.throw()` and `allowedMethods()` raise.
 *
 * Koa gets these from `http-errors`; the router this was extracted from bundled a
 * copy of it. Only the part a router actually needs is here — a status, a
 * message, and the `expose` flag that says whether the message may be shown to
 * the caller — so the package keeps its runtime dependency budget.
 *
 * @module sac-path-router/core/errors
 */

/** An error carrying an HTTP status. */
export class HttpError extends Error {
  /** Status code this error answers with. */
  readonly status: number

  /**
   * Whether `message` is safe to show the caller.
   *
   * 4xx are the caller's fault and their messages are meant to be read; 5xx are
   * ours and stay out of the response body.
   */
  readonly expose: boolean

  /**
   * @param status - HTTP status code.
   * @param message - error message; defaults to the status text.
   * @param options - `expose` override, plus an optional cause.
   */
  constructor(status: number, message?: string, options: { expose?: boolean; cause?: unknown } = {}) {
    super(message ?? statusText(status))
    this.name = 'HttpError'
    this.status = status
    this.expose = options.expose ?? (status >= 400 && status < 500)
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause
  }
}

/** 501, as `allowedMethods()` raises it. */
export function notImplemented(message?: string): HttpError {
  return new HttpError(501, message ?? 'Not Implemented', { expose: true })
}

/** 405, as `allowedMethods()` raises it. */
export function methodNotAllowed(message?: string): HttpError {
  return new HttpError(405, message ?? 'Method Not Allowed', { expose: true })
}

/** Reason phrase for a status, or a generic fallback. */
function statusText(status: number): string {
  const known: Record<number, string> = {
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 406: 'Not Acceptable', 408: 'Request Timeout',
    409: 'Conflict', 410: 'Gone', 413: 'Payload Too Large', 415: 'Unsupported Media Type',
    418: 'I am a Teapot', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
    503: 'Service Unavailable', 504: 'Gateway Timeout',
  }
  return known[status] ?? `HTTP ${status}`
}

/**
 * Build an error the way Koa's `ctx.throw` accepts one.
 *
 * Accepts `(status)`, `(status, message)`, `(status, Error)`, `(message)`, or an
 * `Error` — the argument shapes http-errors supports and callers rely on.
 *
 * @param args - status, message, or an existing error.
 * @returns the error to throw.
 */
export function createError(...args: unknown[]): HttpError {
  const [first, second] = args
  let status = 500
  let message: string | undefined
  if (typeof first === 'number') {
    status = first
    if (typeof second === 'string') message = second
    else if (second instanceof Error) message = second.message
  } else if (typeof first === 'string') {
    status = 500
    message = first
  } else if (first instanceof Error) {
    const carried = (first as { status?: unknown }).status
    status = typeof carried === 'number' ? carried : 500
    message = first.message
  }
  const error = new HttpError(status, message)
  if (first instanceof Error && first.stack !== undefined) error.stack = first.stack
  return error
}
