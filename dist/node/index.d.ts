/**
 * Node adapter: serve a routed fetch handler over `node:http`.
 *
 * Only this entry imports Node builtins, so the core, the Koa dialect, and the
 * Express dialect stay loadable in a browser.
 *
 * @module sac-path-router/node
 */
import { type IncomingMessage, type Server, type ServerResponse } from 'node:http';
/** A request handler: one web `Request` in, one web `Response` out. */
export type RequestHandler = (request: Request) => Response | Promise<Response>;
/** What {@link serve} resolves to. */
export interface ServedServer {
    /** The listening server. */
    server: Server;
    /** Origin the server is reachable at, e.g. `http://127.0.0.1:43117`. */
    origin: string;
    /** Stop listening and release the port. */
    close(): Promise<void>;
}
/**
 * Build a web `Request` from a Node request.
 *
 * @param incoming - the Node request.
 * @param origin - optional origin override, for deployments behind a proxy.
 * @returns the equivalent web request.
 */
export declare function toFetchRequest(incoming: IncomingMessage, origin?: string): Request;
/**
 * Write a web `Response` to a Node response.
 *
 * @param outgoing - the Node response.
 * @param response - the response to send.
 */
export declare function writeFetchResponse(outgoing: ServerResponse, response: Response): Promise<void>;
/**
 * Turn a request handler into a Node request listener.
 *
 * @param handler - the routed fetch handler.
 * @returns a listener usable with `node:http`, Express, or a WebSocket upgrade owner.
 */
export declare function createListener(handler: RequestHandler): (incoming: IncomingMessage, outgoing: ServerResponse) => void;
/**
 * Create an HTTP server for a request handler.
 *
 * @param handler - the routed fetch handler.
 * @returns the server, not yet listening.
 */
export declare function createServer(handler: RequestHandler): Server;
/**
 * Listen on one port and resolve once the address is known.
 *
 * @param handler - the routed fetch handler.
 * @param options - port (0 picks a free one) and host.
 * @returns the server, its origin, and a closer.
 */
export declare function serve(handler: RequestHandler, options?: {
    port?: number;
    host?: string;
}): Promise<ServedServer>;
//# sourceMappingURL=index.d.ts.map