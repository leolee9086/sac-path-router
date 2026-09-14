/**
 * Node adapter: serve a routed fetch handler over `node:http`.
 *
 * Only this entry imports Node builtins, so the core, the Koa dialect, and the
 * Express dialect stay loadable in a browser.
 *
 * @module sac-path-router/node
 */
import { createServer as createHttpServer } from 'node:http';
import { Readable } from 'node:stream';
/**
 * Build a web `Request` from a Node request.
 *
 * @param incoming - the Node request.
 * @param origin - optional origin override, for deployments behind a proxy.
 * @returns the equivalent web request.
 */
export function toFetchRequest(incoming, origin) {
    const host = incoming.headers.host ?? '127.0.0.1';
    const protocol = forwardedProto(incoming) ?? 'http';
    const url = new URL(incoming.url ?? '/', origin ?? `${protocol}://${host}`);
    const method = (incoming.method ?? 'GET').toUpperCase();
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
        if (value === undefined)
            continue;
        if (Array.isArray(value))
            for (const one of value)
                headers.append(name, one);
        else
            headers.set(name, value);
    }
    const carriesBody = method !== 'GET' && method !== 'HEAD';
    const init = { method, headers };
    if (carriesBody) {
        init.body = Readable.toWeb(incoming);
        init.duplex = 'half';
    }
    return new Request(url, init);
}
/**
 * Write a web `Response` to a Node response.
 *
 * @param outgoing - the Node response.
 * @param response - the response to send.
 */
export async function writeFetchResponse(outgoing, response) {
    outgoing.statusCode = response.status;
    outgoing.statusMessage = response.statusText;
    for (const [name, value] of response.headers) {
        if (name === 'set-cookie')
            continue;
        outgoing.setHeader(name, value);
    }
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length > 0)
        outgoing.setHeader('set-cookie', cookies);
    if (response.body === null) {
        outgoing.end();
        return;
    }
    const reader = response.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            outgoing.write(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    outgoing.end();
}
/**
 * Turn a request handler into a Node request listener.
 *
 * @param handler - the routed fetch handler.
 * @returns a listener usable with `node:http`, Express, or a WebSocket upgrade owner.
 */
export function createListener(handler) {
    return (incoming, outgoing) => {
        void (async () => {
            try {
                const response = await handler(toFetchRequest(incoming));
                await writeFetchResponse(outgoing, response);
            }
            catch (error) {
                // A cancelled request has nowhere to send a status: drop the socket
                // instead of reporting the cancellation as a server failure.
                if (outgoing.headersSent || incoming.destroyed || isAbort(error)) {
                    outgoing.destroy();
                    return;
                }
                outgoing.statusCode = 500;
                outgoing.setHeader('content-type', 'text/plain; charset=utf-8');
                outgoing.end(error instanceof Error ? error.message : String(error));
            }
        })();
    };
}
/**
 * Create an HTTP server for a request handler.
 *
 * @param handler - the routed fetch handler.
 * @returns the server, not yet listening.
 */
export function createServer(handler) {
    return createHttpServer(createListener(handler));
}
/**
 * Listen on one port and resolve once the address is known.
 *
 * @param handler - the routed fetch handler.
 * @param options - port (0 picks a free one) and host.
 * @returns the server, its origin, and a closer.
 */
export async function serve(handler, options = {}) {
    const server = createServer(handler);
    const host = options.host ?? '127.0.0.1';
    const port = options.port ?? 0;
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.off('error', reject);
            resolve();
        });
    });
    const address = server.address();
    const actual = typeof address === 'object' && address !== null ? address.port : port;
    return {
        server,
        origin: `http://${host}:${actual}`,
        close: () => new Promise((resolve, reject) => {
            server.close(error => (error === undefined || error === null ? resolve() : reject(error)));
        }),
    };
}
/** First `x-forwarded-proto` value, when a proxy supplied one. */
function forwardedProto(incoming) {
    const value = incoming.headers['x-forwarded-proto'];
    const first = (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();
    return first === undefined || first.length === 0 ? undefined : first;
}
/** Whether an error is a cancellation rather than a failure. */
function isAbort(error) {
    return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}
//# sourceMappingURL=index.js.map