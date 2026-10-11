/**
 * Task orchestration: routes that call each other by name.
 *
 * The reference router carried a small engine on top of the routing stack —
 * register a named task, then run it by name, with a task allowed to rewrite
 * `ctx.path` to hand off to the next one. It is how a chain of processing steps
 * gets expressed without a caller knowing the order.
 *
 * @module sac-path-router/core/tasks
 */

import type { RouterContext } from './context.js'
import type { Middleware } from './compose.js'
import { Router } from './router.js'

/** A task handler: read or rewrite the context, then return. */
export type TaskHandler<Context extends RouterContext = RouterContext> =
  (context: Context) => unknown | Promise<unknown>

/**
 * A chain of named tasks over one router.
 *
 * Tasks are ordinary routes, so a task name is a path and the same router can
 * carry both tasks and ordinary routes without them interfering.
 */
export class TaskRunner<Context extends RouterContext = RouterContext> {
  /** The router the tasks live on. */
  readonly router: Router<Context>

  /**
   * @param router - the router to register tasks on; one is created when omitted.
   */
  constructor(router?: Router<Context>) {
    this.router = router ?? new Router<Context>()
  }

  /**
   * Register a named task.
   *
   * @param name - the task's name, which is also the path it answers on.
   * @param handler - what the task does.
   */
  register(name: string, handler: TaskHandler<Context>): this {
    // A task is a route whose middleware receives the context; it never produces
    // a response of its own, which is what keeps it composable with routing.
    this.router.all(name, (async (context: Context) => {
      await handler(context)
    }) as unknown as Middleware<Context>)
    return this
  }

  /**
   * Run one task, following hand-offs.
   *
   * A task that assigns `context.path` hands control to whatever task answers
   * on the new path, exactly as the reference engine did. The chain is bounded,
   * so a cycle reports itself instead of hanging.
   *
   * @param context - the context to run against; `context.path` names the task.
   * @returns whatever the last task left in `context.state`.
   * @throws when no task answers the path, or when the chain does not settle.
   */
  async run(context: Context): Promise<Record<string, unknown>> {
    const limit = 64
    for (let hop = 0; hop < limit; hop += 1) {
      const task = this.router.stack.find(layer => layer.path === context.path)
      if (task === undefined) throw new Error(`sac-path-router: no task named "${context.path}"`)
      const before = context.path
      for (const middleware of task.stack) await middleware(context, async () => {})
      // A task that did not move the path is the end of the chain.
      if (context.path === before) return context.state
    }
    throw new Error(`sac-path-router: task chain did not settle after ${limit} hand-offs`)
  }

  /**
   * Start a chain at `name`.
   *
   * @param name - the first task.
   * @param context - the context to run against.
   * @returns whatever the chain left in `context.state`.
   */
  async runFrom(name: string, context: Context): Promise<Record<string, unknown>> {
    context.path = name
    return await this.run(context)
  }
}

/** Convenience factory, so callers need not use `new`. */
export function createTaskRunner<Context extends RouterContext = RouterContext>(
  router?: Router<Context>,
): TaskRunner<Context> {
  return new TaskRunner<Context>(router)
}
