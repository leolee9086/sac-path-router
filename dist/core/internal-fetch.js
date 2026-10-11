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
import { RouterContext, createContext } from './context.js';
/**
 * Call a route from inside the process.
 *
 * @param router - the router whose routes answer the path.
 * @param path - the path to dispatch.
 * @param options - method, headers, body, signal, and scope.
 * @returns the context the route wrote to.
 * @throws when nothing answers the path, or when the signal aborts.
 */
export async function internalFetch(router, path, options = {}) {
    const origin = options.origin ?? 'http://internal';
    const method = (options.method ?? 'GET').toUpperCase();
    const carriesBody = method !== 'GET' && method !== 'HEAD';
    const init = {
        method,
        headers: options.headers ?? {},
    };
    if (carriesBody && options.body !== undefined) {
        init.body = options.body;
        init.duplex = 'half';
    }
    if (options.signal !== undefined)
        init.signal = options.signal;
    const request = new Request(new URL(path, origin), init);
    const context = createContext(request);
    if (options.scope !== undefined)
        context.state['scope'] = options.scope;
    const run = router.routes();
    const reached = new Promise((resolve, reject) => {
        // The terminal runs only when no route claimed the path: that is a 404 for an
        // internal call, not something to hand to a network.
        const terminal = async () => {
            reject(new Error(`sac-path-router: internal call found no route for "${path}"`));
        };
        run(context, terminal).then(resolve, reject);
    });
    const aborted = options.signal === undefined ? undefined : abortPromise(options.signal);
    await (aborted === undefined ? reached : Promise.race([reached, aborted]));
    // A route that moved `ctx.path` handed off; follow it the same way the fetch
    // entry would, so internal calls behave like real ones.
    if (context.path !== new URL(path, origin).pathname) {
        return await internalFetch(router, context.path, { ...options, method: context.method });
    }
    return context;
}
/** A promise that rejects when `signal` aborts. */
function abortPromise(signal) {
    return new Promise((_resolve, reject) => {
        if (signal.aborted) {
            reject(new Error('Aborted'));
            return;
        }
        signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    });
}
/**
 * Build a bound internal fetch.
 *
 * @param router - the router to call into.
 * @returns `(path, options) => Promise<context>`.
 */
export function buildInternalFetch(router) {
    return (path, options) => internalFetch(router, path, options);
}
//# sourceMappingURL=internal-fetch.js.map