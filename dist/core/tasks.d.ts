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
import type { RouterContext } from './context.js';
import { Router } from './router.js';
/** A task handler: read or rewrite the context, then return. */
export type TaskHandler<Context extends RouterContext = RouterContext> = (context: Context) => unknown | Promise<unknown>;
/**
 * A chain of named tasks over one router.
 *
 * Tasks are ordinary routes, so a task name is a path and the same router can
 * carry both tasks and ordinary routes without them interfering.
 */
export declare class TaskRunner<Context extends RouterContext = RouterContext> {
    /** The router the tasks live on. */
    readonly router: Router<Context>;
    /**
     * @param router - the router to register tasks on; one is created when omitted.
     */
    constructor(router?: Router<Context>);
    /**
     * Register a named task.
     *
     * @param name - the task's name, which is also the path it answers on.
     * @param handler - what the task does.
     */
    register(name: string, handler: TaskHandler<Context>): this;
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
    run(context: Context): Promise<Record<string, unknown>>;
    /**
     * Start a chain at `name`.
     *
     * @param name - the first task.
     * @param context - the context to run against.
     * @returns whatever the chain left in `context.state`.
     */
    runFrom(name: string, context: Context): Promise<Record<string, unknown>>;
}
/** Convenience factory, so callers need not use `new`. */
export declare function createTaskRunner<Context extends RouterContext = RouterContext>(router?: Router<Context>): TaskRunner<Context>;
//# sourceMappingURL=tasks.d.ts.map