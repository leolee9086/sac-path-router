/**
 * Middleware composition with the Koa contract: one `next()` per middleware,
 * called at most once, awaiting the downstream chain.
 *
 * Derived from koa-compose (MIT, Copyright (c) 2013 TJ Holowaychuk); see
 * THIRD-PARTY-NOTICES.md.
 *
 * @module sac-path-router/core/compose
 */
/**
 * Compose a middleware stack into one `(context, next?) => Promise<void>`.
 *
 * @param stack - middleware in call order.
 * @returns the composed runner; calling `next()` twice inside one middleware rejects.
 * @throws {TypeError} when the stack is not an array of functions.
 */
export function compose(stack) {
    if (!Array.isArray(stack))
        throw new TypeError('middleware stack must be an array');
    for (const fn of stack) {
        if (typeof fn !== 'function')
            throw new TypeError('middleware must be a function');
    }
    return function run(context, next) {
        // Last called index, so a middleware calling next() twice is refused instead
        // of silently running the rest of the stack again.
        let index = -1;
        const dispatch = (i) => {
            if (i <= index)
                return Promise.reject(new Error('next() called multiple times'));
            index = i;
            const fn = i === stack.length ? next : stack[i];
            if (fn === undefined)
                return Promise.resolve();
            try {
                return Promise.resolve(fn(context, (() => dispatch(i + 1)))).then(() => undefined);
            }
            catch (error) {
                return Promise.reject(error);
            }
        };
        return dispatch(0);
    };
}
//# sourceMappingURL=compose.js.map