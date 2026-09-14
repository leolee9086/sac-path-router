/**
 * The fetch entry: a `fetch`-shaped function whose requests are routed.
 *
 * Unmatched traffic falls through to the network — which is what makes this an
 * interceptor rather than a mock server — while a matching local route answers
 * without ever leaving the process. A middleware that rewrites `ctx.path`
 * re-enters the router, bounded by {@link FetchEntryOptions.maxRewrites}.
 *
 * @module sac-path-router/core/fetch-entry
 */
import { RouterContext, type RouterScope } from './context.js';
import type { Next } from './compose.js';
/**
 * Anything the entry can dispatch through: the core router, the Koa dialect's
 * router, or the Express dialect's adapter.
 */
export interface DispatchableRouter<Context extends RouterContext = RouterContext> {
    /** The routing middleware, in the core's `(context, next)` shape. */
    routes(): (context: Context, next?: Next) => Promise<void>;
    /**
     * Whether some route claims a path, whatever the method. A dialect that does
     * not expose it falls back to the matched layers its dispatch recorded.
     */
    claims?(path: string): boolean;
}
/** Options for {@link createFetchEntry}. */
export interface FetchEntryOptions<Context extends RouterContext = RouterContext> {
    /** Router whose layers decide what a request means. */
    router: DispatchableRouter<Context>;
    /** Final handler for an unmatched (or explicitly forwarded) request; defaults to `globalThis.fetch`. */
    network?: typeof fetch;
    /** Used instead of the network when one is not configured. */
    fallback?: (request: Request, context: Context) => Response | Promise<Response>;
    /** Request-scoped facts attached to `ctx.scope` before routing. */
    scope?: (request: Request) => RouterScope | undefined;
    /** Bound on `ctx.path` rewrites; defaults to 5. */
    maxRewrites?: number;
    /** Builds the context for one request; defaults to {@link createContext}. */
    createContext?: (request: Request) => Context;
    /** Turns a thrown middleware error into a response; rethrown when it returns undefined. */
    onError?: (error: unknown, context: Context) => Response | Promise<Response> | undefined;
}
/** The routed `fetch` function. */
export type FetchEntry = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/** Bound on `ctx.path` rewrites when a caller does not choose one. */
export declare const DEFAULT_MAX_REWRITES = 5;
/**
 * Build a routed `fetch`.
 *
 * @param options - router, network, and scope hooks.
 * @returns a function with the `fetch` signature.
 */
export declare function createFetchEntry<Context extends RouterContext = RouterContext>(options: FetchEntryOptions<Context>): FetchEntry;
/**
 * A `HEAD` response carries the headers of the equivalent `GET` and no body.
 *
 * @param request - the request that was routed.
 * @param response - the response a route or the network produced.
 * @returns a bodyless response for `HEAD`, or the response unchanged.
 */
export declare function headSafe(request: Request, response: Response): Response;
/**
 * Turn a locally produced status/body into a `Response`.
 *
 * @param context - the context a local route wrote to.
 * @returns the response a caller receives.
 */
export declare function materialize(context: RouterContext): Response;
//# sourceMappingURL=fetch-entry.d.ts.map