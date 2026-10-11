/**
 * Internal fetch: call this router from inside the process, without a network.
 *
 * The reference router carried this so one part of an application could invoke
 * another part's routes directly — same paths, same middleware, same params, but
 * no socket and no HTTP. It is also what makes a router testable without
 * standing up a server.
 *
 * The reference had to hand-build a mock context because it had no web-standard
 * request; here a real `Request` and the router's own context do the job, so a
 * route reached this way cannot tell the difference.
 *
 * @module sac-path-router/core/internal-fetch
 */
import { RouterContext } from './context.js';
import type { DispatchableRouter } from './fetch-entry.js';
/** Options for one internal call. */
export interface InternalFetchOptions {
    /** HTTP method; defaults to GET. */
    method?: string;
    /** Request headers. */
    headers?: Record<string, string>;
    /** Request body. */
    body?: string;
    /** Abort signal; aborting rejects the call. */
    signal?: AbortSignal;
    /** Origin to resolve the path against; defaults to `http://internal`. */
    origin?: string;
    /** Request-scoped facts to attach before routing. */
    scope?: Record<string, unknown>;
}
/**
 * Call a route from inside the process.
 *
 * @param router - the router whose routes answer the path.
 * @param path - the path to dispatch.
 * @param options - method, headers, body, signal, and scope.
 * @returns the context the route wrote to.
 * @throws when nothing answers the path, or when the signal aborts.
 */
export declare function internalFetch<Context extends RouterContext = RouterContext>(router: DispatchableRouter<Context>, path: string, options?: InternalFetchOptions): Promise<Context>;
/**
 * Build a bound internal fetch.
 *
 * @param router - the router to call into.
 * @returns `(path, options) => Promise<context>`.
 */
export declare function buildInternalFetch<Context extends RouterContext = RouterContext>(router: DispatchableRouter<Context>): (path: string, options?: InternalFetchOptions) => Promise<Context>;
//# sourceMappingURL=internal-fetch.d.ts.map