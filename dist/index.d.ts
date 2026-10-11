/**
 * sac-path-router — a universal router with a fetch entry.
 *
 * The core is dialect-neutral and built only on web standards, so the same
 * routes run in a browser, in Node, and inside an in-process fetch
 * interceptor. `sac-path-router/koa` and `sac-path-router/express` add the two handler
 * dialects; `sac-path-router/node` adapts a Node HTTP server.
 *
 * @module sac-path-router
 */
export { compose } from './core/compose.js';
export type { Middleware, Next } from './core/compose.js';
export { Layer } from './core/layer.js';
export type { LayerOptions } from './core/layer.js';
export { RouterContext, createContext } from './core/context.js';
export type { RouterScope } from './core/context.js';
export { Router, createRouter, HTTP_METHODS } from './core/router.js';
export type { HttpMethod, MatchResult, ParamHandler, RouterOptions } from './core/router.js';
export { createFetchEntry, materialize, headSafe, DEFAULT_MAX_REWRITES } from './core/fetch-entry.js';
export type { DispatchableRouter, FetchEntry, FetchEntryOptions } from './core/fetch-entry.js';
export { HttpError, createError, methodNotAllowed, notImplemented } from './core/errors.js';
export { TaskRunner, createTaskRunner } from './core/tasks.js';
export type { TaskHandler } from './core/tasks.js';
export { internalFetch, buildInternalFetch } from './core/internal-fetch.js';
export type { InternalFetchOptions } from './core/internal-fetch.js';
export { RegexpMatcher, Radix3Matcher, createMatcher, EVERY_METHOD } from './core/matchers.js';
export type { MatchableContext, RouteMatch, RouterMatcher } from './core/matchers.js';
//# sourceMappingURL=index.d.ts.map