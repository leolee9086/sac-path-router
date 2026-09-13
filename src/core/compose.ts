/**
 * Middleware composition with the Koa contract: one `next()` per middleware,
 * called at most once, awaiting the downstream chain.
 *
 * @module sac-path-router/core/compose
 */

/** Termination of a middleware chain. */
export type Next = () => Promise<void>

/** One middleware: read or rewrite `context`, then either await `next()` or return. */
export type Middleware<Context> = (context: Context, next: Next) => unknown

/**
 * Compose a middleware stack into one `(context, next?) => Promise<void>`.
 *
 * @param stack - middleware in call order.
 * @returns the composed runner; calling `next()` twice inside one middleware rejects.
 * @throws {TypeError} when the stack is not an array of functions.
 */
export function compose<Context>(
  stack: readonly Middleware<Context>[],
): (context: Context, next?: Next) => Promise<void> {
  if (!Array.isArray(stack)) throw new TypeError('middleware stack must be an array')
  for (const fn of stack) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function')
  }
  return function run(context: Context, next?: Next): Promise<void> {
    // Last called index, so a middleware calling next() twice is refused instead
    // of silently running the rest of the stack again.
    let index = -1
    const dispatch = (i: number): Promise<void> => {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      const fn = i === stack.length ? next : stack[i]
      if (fn === undefined) return Promise.resolve()
      try {
        return Promise.resolve(fn(context, (() => dispatch(i + 1)) as Next)).then(() => undefined)
      } catch (error) {
        return Promise.reject(error)
      }
    }
    return dispatch(0)
  }
}
