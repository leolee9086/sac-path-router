/**
 * Route layer: one path pattern, its methods, and its middleware stack.
 * Matching delegates to `path-to-regexp`, which runs unchanged in browsers and
 * Node, so a pattern means the same thing on both.
 *
 * Layer shape, `setPrefix`, capture handling, and parameter-handler ordering are
 * derived from @koa/router's `lib/layer.js` (MIT, Copyright (c) 2015 @koajs
 * maintainers and contributors); see THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/core/layer
 */

import { compile, parse, pathToRegexp, type Key } from 'path-to-regexp'
import type { Middleware, Next } from './compose.js'

/** Pattern standing in for a layer whose matching the router's matcher owns. */
const NEVER_MATCHES = /(?!)/

/** Options a layer accepts; the matching ones are forwarded to `path-to-regexp`. */
export interface LayerOptions {
  /** Route name, addressable through `Router#url`. */
  name?: string | null
  /** Case-sensitive matching; defaults to false. */
  sensitive?: boolean
  /** Require the trailing slash; defaults to false. */
  strict?: boolean
  /** `false` matches a prefix instead of the whole path; defaults to true. */
  end?: boolean
  /** Prefix prepended to `path`. */
  prefix?: string
  /** Capture nothing; used for pathless `use()` middleware. */
  ignoreCaptures?: boolean
  /**
   * Accept a pattern `path-to-regexp` cannot compile, leaving that pattern's
   * matching to the router's matcher. Radix syntax (`**`) needs this; by default
   * an uncompilable pattern is rejected at registration.
   */
  toleratePatternErrors?: boolean
}

/**
 * One registered route.
 *
 * `GET` implies `HEAD`, exactly as Koa's router does, so a HEAD probe reaches
 * the same handlers that produced the GET response.
 */
export class Layer<Context extends { params: Record<string, string> }> {
  /** Absolute pattern this layer matches. */
  path: string

  /** Upper-cased method names, or empty for pathless middleware. */
  readonly methods: string[] = []

  /** Parameter descriptors parsed out of {@link path}. */
  paramNames: Key[] = []

  /** Middleware this layer contributes. */
  readonly stack: Middleware<Context>[] = []

  /** Compiled matcher for {@link path}. */
  regexp: RegExp

  /** Route name, or null when it was registered anonymously. */
  readonly name: string | null

  /** The options this layer was created with. */
  readonly opts: LayerOptions

  /**
   * @param path - path pattern.
   * @param methods - methods this layer answers; empty means every method.
   * @param middleware - one handler or a stack of them.
   * @param opts - matching options, name, and prefix.
   */
  constructor(
    path: string,
    methods: readonly string[],
    middleware: Middleware<Context> | readonly Middleware<Context>[],
    opts: LayerOptions = {},
  ) {
    this.opts = opts
    this.name = opts.name ?? null
    this.stack = Array.isArray(middleware)
      ? [...(middleware as readonly Middleware<Context>[])]
      : [middleware as Middleware<Context>]
    for (const method of methods) {
      const upper = method.toUpperCase()
      this.methods.push(upper)
      if (upper === 'GET') this.methods.unshift('HEAD')
    }
    for (const fn of this.stack) {
      if (typeof fn !== 'function') {
        throw new TypeError(`${methods.toString()} \`${opts.name ?? path}\`: middleware must be a function`)
      }
    }
    this.path = path
    this.regexp = compilePattern(this.path, this.paramNames, this.opts)
  }

  /** Whether `path` matches this layer. */
  match(path: string): boolean {
    return this.regexp.test(path)
  }

  /** Captured groups of `path`, or an empty list for a capture-less layer. */
  captures(path: string): string[] {
    if (this.opts.ignoreCaptures === true) return []
    return path.match(this.regexp)?.slice(1) ?? []
  }

  /** Named parameters of `path`, merged over `params`. */
  params(path: string, captures: readonly string[], params: Record<string, string> = {}): Record<string, string> {
    for (let i = 0; i < captures.length; i += 1) {
      const key = this.paramNames[i]
      const capture = captures[i]
      if (key !== undefined && capture !== undefined && capture.length > 0) {
        defineParam(params, String(key.name), safeDecode(capture))
      }
    }
    return params
  }

  /** Expand this layer's pattern into a URL. */
  url(params?: unknown, options?: { query?: string | Record<string, unknown> }): string {
    let toPath: (values: Record<string, unknown>) => string
    try {
      toPath = compile(this.path, { encode: encodeURIComponent })
    } catch (error) {
      // A matcher-owned pattern (radix `**`, for one) has no compiled form here:
      // fill the named segments directly so a named route still expands.
      if (this.opts.toleratePatternErrors !== true) throw error
      toPath = values => this.path.replace(/:([A-Za-z0-9_]+)|\*/g, (match, name: string | undefined) =>
        name === undefined ? String(values['*'] ?? match) : encodeURIComponent(String(values[name] ?? match)))
    }
    const tokens = this.parseTokens()
    let values: Record<string, unknown> = {}
    if (Array.isArray(params)) {
      let i = 0
      for (const token of tokens) {
        if (typeof token === 'object' && token.name !== undefined) values[String(token.name)] = params[i++]
      }
    } else if (params !== undefined && typeof params === 'object') {
      values = params as Record<string, unknown>
    }
    const expanded = toPath(values as never)
    const query = options?.query
    if (query === undefined) return expanded
    const search = typeof query === 'string' ? query : new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    ).toString()
    return search.length === 0 ? expanded : `${expanded}?${search}`
  }

  /** Prefix this layer's pattern, recompiling its matcher. */
  setPrefix(prefix: string): this {
    this.path = this.path !== '/' || this.opts.strict === true ? `${prefix}${this.path}` : prefix
    this.paramNames = []
    this.regexp = compilePattern(this.path, this.paramNames, this.opts)
    return this
  }

  /** Parsed tokens of this layer's pattern, or none when the matcher owns it. */
  private parseTokens(): ReturnType<typeof parse> {
    try {
      return parse(this.path)
    } catch (error) {
      if (this.opts.toleratePatternErrors !== true) throw error
      return []
    }
  }

  /**
   * Inject one parameter handler into this layer's stack, ordered before the
   * handlers of every later-declared parameter, as Koa's router does.
   *
   * @param paramName - parameter this handler validates.
   * @param fn - receives the captured value, the context, and the chain's `next`.
   */
  param(paramName: string, fn: (value: string, context: Context, next: Next) => unknown): this {
    const names = this.paramNames.map(key => key.name)
    const position = names.indexOf(paramName)
    if (position === -1) return this
    const middleware = ((context: Context, next: Next) =>
      fn(context.params[paramName] as string, context, next)) as Middleware<Context> & { param?: string }
    middleware.param = paramName
    const inserted = this.stack.some((existing, index) => {
      const marked = (existing as { param?: string }).param
      if (marked === undefined || names.indexOf(marked) > position) {
        this.stack.splice(index, 0, middleware)
        return true
      }
      return false
    })
    if (!inserted) this.stack.push(middleware)
    return this
  }
}

/** Decode one capture, keeping the raw text when it is not valid percent-encoding. */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Compile one pattern, or leave it to the router's matcher.
 *
 * @param path - the layer's pattern.
 * @param keys - filled with the pattern's parameter descriptors.
 * @param tolerate - accept a pattern `path-to-regexp` rejects (radix `**`).
 * @returns the compiled matcher, or one that never matches when the pattern is matcher-owned.
 * @throws when the pattern is uncompilable and {@link LayerOptions.toleratePatternErrors} is not set.
 */
function compilePattern(path: string, keys: Key[], opts: LayerOptions): RegExp {
  try {
    const keys_: Key[] = []
    const regexp = pathToRegexp(path, keys_, opts)
    keys.push(...keys_)
    return regexp
  } catch (error) {
    if (opts.toleratePatternErrors !== true) throw error
    keys.length = 0
    return NEVER_MATCHES
  }
}

/**
 * Write one parameter as an own data property.
 *
 * A pattern may name a parameter `__proto__`, `constructor`, or `prototype`;
 * assigning those through `params[name] = value` would reach the prototype
 * chain instead of the parameter bag, which is the prototype-pollution class of
 * router vulnerabilities. Defining the property keeps the value usable and the
 * object's prototype untouched.
 *
 * @param target - parameter bag to write into.
 * @param name - parameter name from the route pattern.
 * @param value - decoded capture.
 */
export function defineParam(target: Record<string, string>, name: string, value: string): void {
  Object.defineProperty(target, name, { value, writable: true, enumerable: true, configurable: true })
}
