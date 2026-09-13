/**
 * Matcher tests: the same route table must behave identically under
 * `matcher: 'regexp'` (registration order) and `matcher: 'radix3'` (prefix
 * tree), except where radix semantics are the point — specificity, radix
 * wildcards, and pathless middleware running first.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createFetchEntry, createRouter } from '../dist/index.js'
import { createApp } from '../dist/koa/index.js'

const MATCHERS = ['regexp', 'radix3']

/** Entry over a router, with a network stub a test can assert against. */
function harness(options, network) {
  const router = createRouter(options)
  return {
    router,
    entry: createFetchEntry({
      router,
      network: network ?? (() => Promise.resolve(new Response('upstream', { status: 599 }))),
    }),
  }
}

for (const matcher of MATCHERS) {
  test(`[${matcher}] params, methods, wildcards, and 405 agree`, async () => {
    const { router, entry } = harness({ matcher })
    router.get('/users/:id', ctx => { ctx.status = 200; ctx.body = `user ${ctx.params.id}` })
    // A multi-segment wildcard both matchers understand: regexp syntax compiles
    // here, and radix3 mode falls back to the regexp scan for it.
    router.get('/files/(.*)', ctx => { ctx.status = 200; ctx.body = `file ${ctx.params[0]}` })
    router.post('/users', ctx => { ctx.status = 201; ctx.body = 'created' })
    router.all('/health', ctx => { ctx.status = 200; ctx.body = 'ok' })
    router.use(router.allowedMethods())

    assert.equal(await (await entry('https://x.test/users/42')).text(), 'user 42')
    assert.equal(await (await entry('https://x.test/files/a/b.txt')).text(), 'file a/b.txt')
    assert.equal((await entry('https://x.test/users', { method: 'POST' })).status, 201)
    assert.equal(await (await entry('https://x.test/health', { method: 'DELETE' })).text(), 'ok')

    const wrongMethod = await entry('https://x.test/users/42', { method: 'POST' })
    assert.equal(wrongMethod.status, 405)
    assert.deepEqual((wrongMethod.headers.get('allow') ?? '').split(',').map(s => s.trim()).sort(), ['GET', 'HEAD'])
  })

  test(`[${matcher}] mounts, groups, and named routes agree`, async () => {
    const app = createApp({ matcher })
    app.group('/api', api => {
      api.get('user', '/users/:id', ctx => { ctx.status = 200; ctx.body = `u${ctx.params.id}` })
    })
    const entry = app.fetch({ network: () => Promise.resolve(new Response('upstream', { status: 599 })) })

    assert.equal(await (await entry('https://x.test/api/users/9')).text(), 'u9')
    assert.equal(app.router.url('user', { id: 5 }), '/api/users/5')
    assert.equal((await entry('https://x.test/other')).status, 599)
  })

  test(`[${matcher}] unclaimed paths pass through and local routes do not`, async () => {
    let networkCalls = 0
    const { router, entry } = harness({ matcher }, () => {
      networkCalls += 1
      return Promise.resolve(new Response('upstream'))
    })
    router.post('/zen/go/v1/chat/completions', ctx => {
      ctx.set('x-opencode-session', 'session-1')
      ctx.responseHeaders.set('x-local', 'yes')
      ctx.status = 200
      ctx.body = 'local'
    })

    const local = await entry('https://opencode.ai/zen/go/v1/chat/completions', { method: 'POST' })
    assert.equal(await local.text(), 'local')
    assert.equal(local.headers.get('x-local'), 'yes')

    const passed = await entry('https://opencode.ai/zen/go/v1/models')
    assert.equal(await passed.text(), 'upstream')
    assert.equal(networkCalls, 1)
  })
}

test('[radix3] a radix wildcard subtree matches where a regexp pattern cannot', async () => {
  const { router, entry } = harness({ matcher: 'radix3' })
  router.get('/assets/**', ctx => { ctx.status = 200; ctx.body = `deep ${ctx.params['_'] ?? ''}` })

  const response = await entry('https://x.test/assets/img/icons/a.svg')
  assert.equal(response.status, 200)
  assert.match(await response.text(), /^deep /)
})

test('[radix3] pathless middleware runs before the matched route', async () => {
  const order = []
  const { router, entry } = harness({ matcher: 'radix3' }, () => Promise.resolve(new Response('upstream', { status: 599 })))
  router.use(async (_ctx, next) => { order.push('middleware'); await next() })
  router.get('/thing', ctx => { order.push('route'); ctx.status = 200; ctx.body = 'ok' })

  assert.equal(await (await entry('https://x.test/thing')).text(), 'ok')
  assert.deepEqual(order, ['middleware', 'route'])
})

test('[radix3] the most specific route wins over registration order', async () => {
  const { router, entry } = harness({ matcher: 'radix3' })
  router.get('/users/:id', ctx => { ctx.status = 200; ctx.body = 'param' })
  router.get('/users/me', ctx => { ctx.status = 200; ctx.body = 'static' })

  assert.equal(await (await entry('https://x.test/users/me')).text(), 'static')
  assert.equal(await (await entry('https://x.test/users/7')).text(), 'param')
})

test('[regexp] registration order still decides, as Koa specifies', async () => {
  const { router, entry } = harness({ matcher: 'regexp' })
  router.get('/users/:id', ctx => { ctx.status = 200; ctx.body = 'param' })
  router.get('/users/me', ctx => { ctx.status = 200; ctx.body = 'static' })
  // Both layers match `/users/me`; the first registered one answers first.
  assert.equal(await (await entry('https://x.test/users/me')).text(), 'param')
})

test('[radix3] a 1200-route table resolves every route, statically and dynamically', async () => {
  const { router, entry } = harness({ matcher: 'radix3' })
  for (let i = 0; i < 1200; i += 1) {
    router.get(`/api/v${i % 3}/resource-${i}/:id`, ctx => { ctx.status = 200; ctx.body = `${i}:${ctx.params.id}` })
  }
  for (const i of [0, 1, 599, 1198, 1199]) {
    const response = await entry(`https://x.test/api/v${i % 3}/resource-${i}/${i}`)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), `${i}:${i}`)
  }
  // A path in the same subtree that no route declares still passes through.
  assert.equal((await entry('https://x.test/api/v1/resource-9999/1')).status, 599)
})

test('[regexp] the same 1200-route table resolves the same routes', async () => {
  const { router, entry } = harness({ matcher: 'regexp' })
  for (let i = 0; i < 1200; i += 1) {
    router.get(`/api/v${i % 3}/resource-${i}/:id`, ctx => { ctx.status = 200; ctx.body = `${i}:${ctx.params.id}` })
  }
  assert.equal(await (await entry('https://x.test/api/v0/resource-0/7')).text(), '0:7')
  assert.equal(await (await entry('https://x.test/api/v2/resource-1199/8')).text(), '1199:8')
})

test('express response helpers: cookie, vary, links, and format', async () => {
  const { createRouter: createExpressRouter } = await import('../dist/express/index.js')
  const router = createExpressRouter()
  router.get('/cookies', (_req, res) => {
    res.cookie('session', 'abc def', { httpOnly: true, sameSite: 'lax', maxAge: 60_000 })
    res.clearCookie('stale', { path: '/' })
    res.vary('accept-encoding')
    res.links({ next: 'https://x.test/page/2' })
    res.status(200).send('ok')
  })
  router.get('/format', (req, res) => {
    if ((req.get('accept') ?? '').includes('application/json')) {
      res.format({ 'application/json': () => res.json({ kind: 'json' }), default: () => res.send('other') })
      return
    }
    res.format({ 'text/plain': () => res.send('text'), default: () => res.status(406).end() })
  })

  const entry = createFetchEntry({ router, network: () => Promise.resolve(new Response('upstream', { status: 599 })) })

  const cookies = await entry('https://x.test/cookies')
  const setCookies = cookies.headers.getSetCookie()
  assert.equal(setCookies.length, 2)
  assert.match(setCookies[0], /^session=abc%20def; Max-Age=60; HttpOnly; SameSite=Lax$/)
  assert.match(setCookies[1], /^stale=; Max-Age=0; Path=\/; Expires=Thu, 01 Jan 1970/)
  assert.equal(cookies.headers.get('vary'), 'accept-encoding')
  assert.equal(cookies.headers.get('link'), '<https://x.test/page/2>; rel="next"')

  const asJson = await entry('https://x.test/format', { headers: { accept: 'application/json' } })
  assert.deepEqual(await asJson.json(), { kind: 'json' })

  const asText = await entry('https://x.test/format', { headers: { accept: 'text/plain' } })
  assert.equal(await asText.text(), 'text')

  const unacceptable = await entry('https://x.test/format', { headers: { accept: 'image/png' } })
  assert.equal(unacceptable.status, 406)
})
