/**
 * sac-path-router behaviour tests. Plain `node:test`, run against the built `dist/`, so
 * the suite exercises exactly what a consumer installs.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { compose, createContext, createFetchEntry, createRouter } from '../dist/index.js'
import { createApp } from '../dist/koa/index.js'
import { createRouter as createExpressRouter } from '../dist/express/index.js'
import { serve } from '../dist/node/index.js'

test('compose runs middleware in order and refuses a second next()', async () => {
  const seen = []
  const run = compose([
    async (ctx, next) => { seen.push('a'); await next(); seen.push('after-a') },
    async (ctx, next) => { seen.push('b'); await next() },
    async () => { seen.push('c') },
  ])
  await run({})
  assert.deepEqual(seen, ['a', 'b', 'c', 'after-a'])

  const twice = compose([async (_ctx, next) => { await next(); await next() }])
  await assert.rejects(() => twice({}), /next\(\) called multiple times/)
})

test('router matches paths, methods, and parameters', async () => {
  const router = createRouter()
  router.get('/users/:id', ctx => { ctx.status = 200; ctx.body = { id: ctx.params.id } })
  router.post('/users', ctx => { ctx.status = 201; ctx.body = 'created' })

  const fetchEntry = createFetchEntry({ router, network: () => Promise.resolve(new Response('network', { status: 599 })) })

  const hit = await fetchEntry('https://example.test/users/42')
  assert.equal(hit.status, 200)
  assert.deepEqual(await hit.json(), { id: '42' })

  const created = await fetchEntry('https://example.test/users', { method: 'POST' })
  assert.equal(created.status, 201)

  const miss = await fetchEntry('https://example.test/other')
  assert.equal(miss.status, 599)
})

test('pathless middleware runs before the network and can rewrite the request', async () => {
  const router = createRouter()
  let reachedNetwork = null
  const fetchEntry = createFetchEntry({
    router,
    network: (request) => { reachedNetwork = request; return Promise.resolve(new Response('upstream')) },
  })
  router.use(async (ctx, next) => { ctx.set('x-added', 'yes'); await next() })

  const response = await fetchEntry('https://example.test/anything')
  assert.equal(await response.text(), 'upstream')
  assert.equal(reachedNetwork.headers.get('x-added'), 'yes')
  assert.equal(reachedNetwork.url, 'https://example.test/anything')
})

test('rewriting ctx.path re-dispatches inside the router', async () => {
  const router = createRouter()
  const seen = []
  router.get('/legacy', async (ctx, next) => { seen.push('legacy'); ctx.path = '/modern'; await next() })
  router.get('/modern', ctx => { seen.push('modern'); ctx.status = 200; ctx.body = 'modern' })
  const fetchEntry = createFetchEntry({
    router,
    network: () => { throw new Error('network must not be reached') },
  })

  const response = await fetchEntry('https://example.test/legacy')
  assert.equal(await response.text(), 'modern')
  assert.deepEqual(seen, ['legacy', 'modern'])
})

test('an unbounded rewrite loop is refused', async () => {
  const router = createRouter()
  router.get('/loop', async (ctx, next) => { ctx.path = ctx.path === '/loop' ? '/loop2' : '/loop'; await next() })
  router.get('/loop2', async (ctx, next) => { ctx.path = '/loop'; await next() })
  const entry = createFetchEntry({ router, maxRewrites: 2, network: () => Promise.resolve(new Response('x')) })
  await assert.rejects(() => entry('https://example.test/loop'), /exceeded 2 internal rewrites/)
})

test('scope is attached before routing', async () => {
  const router = createRouter()
  let observed
  router.post('/zen/go/v1/chat', ctx => { observed = ctx.scope; ctx.status = 200; ctx.body = 'ok' })
  const entry = createFetchEntry({
    router,
    scope: request => ({ provider: 'opencode-go-completions', sessionId: 'session-7', url: request.url }),
    network: () => Promise.resolve(new Response('no')),
  })
  await entry('https://opencode.ai/zen/go/v1/chat', { method: 'POST' })
  assert.deepEqual(observed, {
    provider: 'opencode-go-completions',
    sessionId: 'session-7',
    url: 'https://opencode.ai/zen/go/v1/chat',
  })
})

test('koa application: group, named routes, and allowedMethods', async () => {
  const app = createApp()
  app.use(app.allowedMethods())
  app.group('/api', api => {
    api.get('user', '/users/:id', ctx => { ctx.status = 200; ctx.body = `user ${ctx.params.id}` })
  })

  const entry = app.fetch({ network: () => Promise.resolve(new Response('network')) })
  const hit = await entry('https://example.test/api/users/9')
  assert.equal(await hit.text(), 'user 9')

  const notAllowed = await entry('https://example.test/api/users/9', { method: 'POST' })
  assert.equal(notAllowed.status, 405)
  assert.deepEqual(
    (notAllowed.headers.get('allow') ?? '').split(',').map(part => part.trim()).sort(),
    ['GET', 'HEAD'],
  )

  assert.equal(app.router.url('user', { id: 5 }), '/api/users/5')
})

test('express dialect: params, res helpers, mounts, and errors', async () => {
  const router = createExpressRouter()
  router.use((req, _res, next) => { req.locals ??= {}; next() })
  router.get('/users/:id', (req, res) => {
    res.status(200).json({ id: req.params.id, path: req.path })
  })
  router.post('/users', (req, res) => { res.status(201).send('created') })

  const api = createExpressRouter()
  api.get('/ping', (_req, res) => { res.type('text/plain').send('pong') })
  router.use('/api', api)

  router.get('/boom', () => { throw new Error('kaboom') })
  router.use((error, _req, res, _next) => { res.status(500).json({ message: error.message }) })

  router.route('/multi').get((_req, res) => res.send('get')).post((_req, res) => res.send('post'))

  const entry = createFetchEntry({
    router: { routes: () => router.routes() },
    network: () => Promise.resolve(new Response('network', { status: 599 })),
  })

  const user = await entry('https://example.test/users/7')
  assert.deepEqual(await user.json(), { id: '7', path: '/users/7' })

  const created = await entry('https://example.test/users', { method: 'POST' })
  assert.equal(created.status, 201)
  assert.equal(await created.text(), 'created')

  const ping = await entry('https://example.test/api/ping')
  assert.equal(await ping.text(), 'pong')
  assert.match(ping.headers.get('content-type'), /text\/plain/)

  const boom = await entry('https://example.test/boom')
  assert.equal(boom.status, 500)
  assert.deepEqual(await boom.json(), { message: 'kaboom' })

  const multi = await entry('https://example.test/multi', { method: 'POST' })
  assert.equal(await multi.text(), 'post')

  const miss = await entry('https://example.test/nothing-here')
  assert.equal(miss.status, 599)
})

test('node adapter serves a routed handler over http', async () => {
  const router = createRouter()
  router.get('/hello/:name', ctx => {
    ctx.responseHeaders.set('x-route', 'hello')
    ctx.status = 200
    ctx.body = `hi ${ctx.params.name}`
  })
  const entry = createFetchEntry({ router, network: () => Promise.resolve(new Response('upstream', { status: 502 })) })

  const served = await serve(request => entry(request))
  try {
    const hit = await fetch(`${served.origin}/hello/ada`)
    assert.equal(hit.status, 200)
    assert.equal(hit.headers.get('x-route'), 'hello')
    assert.equal(await hit.text(), 'hi ada')

    const passthrough = await fetch(`${served.origin}/elsewhere`)
    assert.equal(passthrough.status, 502)
    assert.equal(await passthrough.text(), 'upstream')
  } finally {
    await served.close()
  }
})

test('createContext detaches headers from the incoming request', () => {
  const request = new Request('https://example.test/x', { headers: { 'x-in': '1' } })
  const context = createContext(request)
  context.set('x-in', '2')
  assert.equal(request.headers.get('x-in'), '1')
  assert.equal(context.get('x-in'), '2')
})
