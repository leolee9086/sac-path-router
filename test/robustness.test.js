/**
 * Regression net for the failure classes router libraries are usually bitten
 * by: prototype pollution through parameter names, prefix-boundary matching,
 * query strings leaking into matching, responses written twice, `HEAD` bodies,
 * abort propagation, malformed percent-encoding, and parameter handlers running
 * more than once.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createFetchEntry, createRouter } from '../dist/index.js'
import { createRouter as createExpressRouter } from '../dist/express/index.js'

/** An entry whose network handler always fails the test when reached. */
function offline(router) {
  return createFetchEntry({
    router,
    network: () => { throw new Error('the network must not be reached') },
  })
}

test('a parameter named __proto__ cannot pollute prototypes', async () => {
  const router = createRouter()
  let captured
  router.get('/p/:__proto__', ctx => {
    captured = ctx.params
    ctx.status = 200
    ctx.body = String(ctx.params['__proto__'])
  })

  const response = await offline(router)('https://example.test/p/polluted')
  assert.equal(await response.text(), 'polluted')
  assert.equal({}.polluted, undefined)
  assert.equal(Object.getPrototypeOf(captured), Object.prototype)
  assert.ok(Object.hasOwn(captured, '__proto__'))
})

test('constructor and prototype parameter names stay data', async () => {
  const router = createRouter()
  let captured
  router.get('/p/:constructor/:prototype', ctx => {
    captured = ctx.params
    ctx.status = 200
    ctx.body = 'ok'
  })
  await offline(router)('https://example.test/p/a/b')
  assert.equal(captured.constructor, 'a')
  assert.equal(captured.prototype, 'b')
  assert.equal(typeof {}.constructor, 'function')
})

test('a query string never takes part in matching', async () => {
  const router = createRouter()
  router.get('/a', ctx => { ctx.status = 200; ctx.body = ctx.query.x ?? 'none' })
  const response = await offline(router)('https://example.test/a?x=1&y=2')
  assert.equal(await response.text(), '1')
})

test('prefix mounts respect segment boundaries', async () => {
  const router = createRouter()
  const seen = []
  router.use('/api', async (ctx, next) => { seen.push(ctx.path); await next() })
  router.get('/api/users', ctx => { ctx.status = 200; ctx.body = 'users' })
  const entry = createFetchEntry({ router, network: () => Promise.resolve(new Response('upstream', { status: 599 })) })

  assert.equal(await (await entry('https://example.test/api/users')).text(), 'users')
  assert.equal((await entry('https://example.test/api')).status, 599)
  assert.equal((await entry('https://example.test/apix')).status, 599)
  assert.deepEqual(seen, ['/api/users', '/api'])
})

test('case sensitivity follows Koa defaults, and strict mode requires the slash', async () => {
  const lenient = createRouter()
  lenient.get('/Users', ctx => { ctx.status = 200; ctx.body = 'hit' })
  assert.equal((await offline(lenient)('https://example.test/users')).status, 200)

  // Strict matching leaves `/users/` unclaimed, so it passes through upstream.
  const strict = createRouter({ strict: true })
  strict.get('/users', ctx => { ctx.status = 200; ctx.body = 'hit' })
  const passthrough = createFetchEntry({
    router: strict,
    network: () => Promise.resolve(new Response('upstream', { status: 599 })),
  })
  assert.equal((await passthrough('https://example.test/users/')).status, 599)
  assert.equal((await passthrough('https://example.test/users')).status, 200)
})

test('a second route cannot write after the first answered', async () => {
  const router = createRouter()
  router.get('/once', ctx => { ctx.status = 200; ctx.body = 'first' })
  router.get('/once', () => { throw new Error('the second handler must not run') })
  const response = await offline(router)('https://example.test/once')
  assert.equal(await response.text(), 'first')
})

test('HEAD keeps the headers of GET and drops the body', async () => {
  const router = createRouter()
  router.get('/doc', ctx => {
    ctx.responseHeaders.set('x-doc', '1')
    ctx.status = 200
    ctx.body = 'body'
  })
  const response = await offline(router)('https://example.test/doc', { method: 'HEAD' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-doc'), '1')
  assert.equal(response.body, null)

  const upstream = createFetchEntry({
    router: createRouter(),
    network: () => Promise.resolve(new Response('upstream-body', { headers: { 'x-up': '1' } })),
  })
  const passed = await upstream('https://example.test/doc', { method: 'HEAD' })
  assert.equal(passed.headers.get('x-up'), '1')
  assert.equal(passed.body, null)
})

test('the request signal reaches the network', async () => {
  const controller = new AbortController()
  const router = createRouter()
  const entry = createFetchEntry({
    router,
    network: request => Promise.resolve(new Response(String(request.signal.aborted))),
  })
  controller.abort()
  const response = await entry('https://example.test/x', { signal: controller.signal })
  assert.equal(await response.text(), 'true')
})

test('malformed percent-encoding is not fatal', async () => {
  const router = createRouter()
  router.get('/files/:name', ctx => { ctx.status = 200; ctx.body = ctx.params.name })
  const response = await offline(router)('https://example.test/files/%E0%A4%A')
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '%E0%A4%A')
})

test('an async handler that throws rejects the entry', async () => {
  const router = createRouter()
  router.get('/boom', async () => { throw new Error('async kaboom') })
  await assert.rejects(() => offline(router)('https://example.test/boom'), /async kaboom/)
})

test('a local route can read the request body and the network is never consulted', async () => {
  let networkCalls = 0
  const router = createRouter()
  router.post('/echo', async ctx => {
    ctx.status = 200
    ctx.body = await ctx.request.text()
  })
  const entry = createFetchEntry({
    router,
    network: () => { networkCalls += 1; return Promise.resolve(new Response('network')) },
  })
  const response = await entry('https://example.test/echo', { method: 'POST', body: 'hello' })
  assert.equal(await response.text(), 'hello')
  assert.equal(networkCalls, 0)
})

test('an express parameter handler runs once per request and value', async () => {
  const router = createExpressRouter()
  const runs = []
  router.param('id', (req, res, next, value) => { runs.push(value); next() })
  router.get('/a/:id', (_req, res) => { res.send('a') })
  router.get('/b/:id', (_req, res) => { res.send('b') })
  router.use((_req, res) => { res.status(200).end() })

  const entry = createFetchEntry({ router, network: () => Promise.resolve(new Response('upstream', { status: 599 })) })
  await entry('https://example.test/a/7')
  assert.deepEqual(runs, ['7'])
  assert.equal((await entry('https://example.test/none')).status, 200)
})

test('the same router can be mounted twice without sharing paths', async () => {
  const child = createRouter()
  child.get('/ping', ctx => { ctx.status = 200; ctx.body = 'pong' })
  const parent = createRouter()
  parent.use('/one', child)
  parent.use('/two', child)
  const entry = createFetchEntry({
    router: parent,
    network: () => Promise.resolve(new Response('upstream', { status: 599 })),
  })
  assert.equal((await entry('https://example.test/one/ping')).status, 200)
  assert.equal((await entry('https://example.test/two/ping')).status, 200)
  // A path no mount claims stays upstream's business.
  assert.equal((await entry('https://example.test/ping')).status, 599)
})
