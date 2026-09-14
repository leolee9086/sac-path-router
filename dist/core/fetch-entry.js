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
import { Router } from './router.js';
import { RouterContext, createContext } from './context.js';
/** Bound on `ctx.path` rewrites when a caller does not choose one. */
export const DEFAULT_MAX_REWRITES = 5;
/**
 * Build a routed `fetch`.
 *
 * @param options - router, network, and scope hooks.
 * @returns a function with the `fetch` signature.
 */
export function createFetchEntry(options) {
    const maxRewrites = options.maxRewrites ?? DEFAULT_MAX_REWRITES;
    const dispatch = options.router.routes();
    return async function fetchEntry(input, init) {
        let request = input instanceof Request && init === undefined
            ? input
            : new Request(input, init);
        for (let hop = 0; hop <= maxRewrites; hop += 1) {
            const build = (options.createContext ?? createContext);
            const context = build(request);
            const scope = options.scope?.(request);
            if (scope !== undefined)
                context.scope = scope;
            const startPath = context.path;
            const terminal = async () => {
                if (context.responded)
                    return;
                // A rewritten target means the request is being routed again, not sent
                // upstream: the entry re-dispatches on the new path instead.
                if (context.path !== startPath)
                    return;
                // A path some route claims is owned by the router: a request whose
                // method no route answers is a 405, not something to forward upstream.
                // Both facts come from the dispatch that just ran, so the entry works
                // with any dialect.
                const claimed = options.router.claims?.(context.path)
                    ?? context.matched.some(layer => layer.methods.length > 0);
                if (claimed && !context.routed)
                    return;
                context.response = await send(context, request, options);
            };
            try {
                await dispatch(context, terminal);
            }
            catch (error) {
                const handled = options.onError === undefined ? undefined : await options.onError(error, context);
                if (handled !== undefined)
                    return handled;
                throw error;
            }
            if (context.path !== startPath && !context.responded) {
                request = rebuild(request, context);
                continue;
            }
            return headSafe(request, context.response ?? materialize(context));
        }
        throw new Error(`sac-path-router: fetch entry exceeded ${maxRewrites} internal rewrites`);
    };
}
/**
 * A `HEAD` response carries the headers of the equivalent `GET` and no body.
 *
 * @param request - the request that was routed.
 * @param response - the response a route or the network produced.
 * @returns a bodyless response for `HEAD`, or the response unchanged.
 */
export function headSafe(request, response) {
    if (request.method !== 'HEAD' || response.body === null)
        return response;
    return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}
/**
 * Send the context's current target over the network, or through the fallback.
 *
 * @param context - the routed request, possibly rewritten by middleware.
 * @param original - the request as it arrived, used for the body and signal.
 * @param options - the entry's network configuration.
 * @returns the response the terminal produced.
 */
async function send(context, original, options) {
    const carriesBody = context.method !== 'GET' && context.method !== 'HEAD';
    const init = {
        method: context.method,
        headers: context.headers,
        signal: original.signal,
        redirect: original.redirect,
    };
    if (carriesBody && original.body !== null) {
        init.body = original.body;
        // Node requires the half-duplex marker when a stream is sent as a body.
        init.duplex = 'half';
    }
    const outgoing = new Request(context.url, init);
    const network = options.network ?? globalThis.fetch;
    if (typeof network === 'function')
        return await network(outgoing);
    if (options.fallback !== undefined)
        return await options.fallback(outgoing, context);
    throw new Error(`sac-path-router: ${outgoing.url} matched no route and the entry has no network handler`);
}
/** Rebuild the incoming request around a rewritten target, so the router re-runs on the new path. */
function rebuild(original, context) {
    const init = {
        method: context.method,
        headers: context.headers,
        signal: original.signal,
        redirect: original.redirect,
    };
    return new Request(context.url, init);
}
/**
 * Turn a locally produced status/body into a `Response`.
 *
 * @param context - the context a local route wrote to.
 * @returns the response a caller receives.
 */
export function materialize(context) {
    const headers = context.responseHeaders;
    // Koa's default: a route that set a body without a status answers 200, not the
    // 404 the context starts at.
    const status = context.status === 404 && context.body !== undefined && context.body !== null ? 200 : context.status;
    if (status === 204 || status === 304) {
        return new Response(null, { status, headers });
    }
    const body = context.body;
    if (body === undefined || body === null) {
        return new Response(null, { status, headers });
    }
    if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer
        || body instanceof ReadableStream || body instanceof URLSearchParams || body instanceof FormData
        || body instanceof Blob) {
        return new Response(body, { status, headers });
    }
    if (!headers.has('content-type'))
        headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(body), { status, headers });
}
//# sourceMappingURL=fetch-entry.js.map