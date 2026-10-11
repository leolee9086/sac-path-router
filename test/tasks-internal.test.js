/**
 * Tests for task orchestration and internal calls — the two pieces the reference
 * router had that are not about HTTP at all.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildInternalFetch, createContext, createRouter, createTaskRunner, internalFetch, TaskRunner } from '../dist/index.js'

// ------------------------------------------------------------------- tasks

test('a task runs by name and leaves its result in ctx.state', async () => {
  const tasks = createTaskRunner()
  tasks.register('/greet', (ctx) => { ctx.state.greeting = 'hello' })
  const context = createContext(new Request('http://internal/greet'))
  const state = await tasks.run(context)
  assert.deepEqual(state, { greeting: 'hello' })
})

test('a task that moves ctx.path hands off to the next one', async () => {
  const tasks = createTaskRunner()
  const order = []
  tasks.register('/first', (ctx) => { order.push('first'); ctx.path = '/second' })
  tasks.register('/second', (ctx) => { order.push('second'); ctx.state.done = true })
  const state = await tasks.runFrom('/first', createContext(new Request('http://internal/first')))
  assert.deepEqual(order, ['first', 'second'])
  assert.deepEqual(state, { done: true })
})

test('an unknown task name is reported, not silently ignored', async () => {
  const tasks = createTaskRunner()
  await assert.rejects(
    () => tasks.runFrom('/nope', createContext(new Request('http://internal/nope'))),
    /no task named/,
  )
})

test('a task chain that never settles reports itself instead of hanging', async () => {
  const tasks = createTaskRunner()
  tasks.register('/a', (ctx) => { ctx.path = '/b' })
  tasks.register('/b', (ctx) => { ctx.path = '/a' })
  await assert.rejects(
    () => tasks.runFrom('/a', createContext(new Request('http://internal/a'))),
    /did not settle/,
  )
})

test('a task runner can share a router that also carries ordinary routes', async () => {
  const router = createRouter()
  const tasks = new TaskRunner(router)
  assert.equal(tasks.router, router)
  tasks.register('/task', (ctx) => { ctx.state.ran = true })
  router.get('/page', (ctx) => { ctx.status = 200; ctx.body = 'page' })
  assert.equal(router.stack.length, 2)
  assert.deepEqual(await tasks.runFrom('/task', createContext(new Request('http://internal/task'))), { ran: true })
})

// ----------------------------------------------------------- internal fetch

test('an internal call reaches a route without any network', async () => {
  const router = createRouter()
  router.get('/users/:id', (ctx) => {
    ctx.status = 200
    ctx.body = { id: ctx.params.id }
    ctx.state.touched = true
  })
  const context = await internalFetch(router, '/users/7')
  assert.equal(context.status, 200)
  assert.deepEqual(context.body, { id: '7' })
  assert.equal(context.state.touched, true)
})

test('an internal call carries method, headers, body and scope', async () => {
  const router = createRouter()
  let seen = null
  router.post('/echo', async (ctx) => {
    seen = {
      method: ctx.method,
      header: ctx.request.headers.get('x-probe'),
      body: await ctx.request.text(),
      scope: ctx.scope,
    }
    ctx.status = 200
  })
  await internalFetch(router, '/echo', {
    method: 'POST',
    headers: { 'x-probe': 'yes' },
    body: 'payload',
    scope: { sessionId: 's1' },
  })
  assert.equal(seen.method, 'POST')
  assert.equal(seen.header, 'yes')
  assert.equal(seen.body, 'payload')
  assert.deepEqual(seen.scope, { sessionId: 's1' })
})

test('an internal call that matches nothing is an error, not a network trip', async () => {
  const router = createRouter()
  await assert.rejects(() => internalFetch(router, '/missing'), /found no route/)
})

test('an internal call follows a path hand-off like a real request would', async () => {
  const router = createRouter()
  router.get('/old', (ctx) => { ctx.path = '/new' })
  router.get('/new', (ctx) => { ctx.status = 200; ctx.body = 'arrived' })
  const context = await internalFetch(router, '/old')
  assert.equal(context.body, 'arrived')
})

test('an internal call honors an already-aborted signal', async () => {
  const router = createRouter()
  router.get('/slow', (ctx) => { ctx.status = 200 })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    () => internalFetch(router, '/slow', { signal: controller.signal }),
    /Aborted/,
  )
})

test('an internal call resolves relative to the origin it was given', async () => {
  const router = createRouter()
  let seenUrl = null
  router.get('/here', (ctx) => { seenUrl = ctx.url.href; ctx.status = 200 })
  await internalFetch(router, '/here', { origin: 'https://app.test' })
  assert.equal(seenUrl, 'https://app.test/here')
})

test('buildInternalFetch binds a router for repeated calls', async () => {
  const router = createRouter()
  router.get('/ping', (ctx) => { ctx.status = 200; ctx.body = 'pong' })
  const call = buildInternalFetch(router)
  const context = await call('/ping')
  assert.equal(context.body, 'pong')
})
