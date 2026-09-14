/**
 * Middleware composition with the Koa contract: one `next()` per middleware,
 * called at most once, awaiting the downstream chain.
 *
 * Derived from koa-compose (MIT, Copyright (c) 2013 TJ Holowaychuk); see
 * THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/core/compose
 */
/** Termination of a middleware chain. */
export type Next = () => Promise<void>;
/** One middleware: read or rewrite `context`, then either await `next()` or return. */
export type Middleware<Context> = (context: Context, next: Next) => unknown;
/**
 * Compose a middleware stack into one `(context, next?) => Promise<void>`.
 *
 * @param stack - middleware in call order.
 * @returns the composed runner; calling `next()` twice inside one middleware rejects.
 * @throws {TypeError} when the stack is not an array of functions.
 */
export declare function compose<Context>(stack: readonly Middleware<Context>[]): (context: Context, next?: Next) => Promise<void>;
//# sourceMappingURL=compose.d.ts.map