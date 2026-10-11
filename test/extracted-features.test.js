/**
 * The behaviours that actually broke, or would break, in real use.
 *
 * Every test here answers “what went wrong when someone used this?” — not “what
 * did I write?”. Anything that only restates the implementation (that `del` is an
 * alias, that 26 verbs exist, that `route()` returns false) lives nowhere: it can
 * never fail, so it can never find anything, and it costs attention on every run.
 *
 * The request-shape suite is `fetch-entry-shapes.test.js`; that one is the reason
 * this file is short.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createFetchEntry, createRouter } from '../dist/index.js'

/** An entry whose network only reports that it was reached. */
function entryFor(router) {
  return createFetchEntry({
    router,
    network: () => Promise.resolve(new Response('network', { status: 599 })),
  })
}

// --------------------------------------------------- a router for one host

test('a router configured for another host does not answer', async () => {
  // Real failure this prevents: one router mounted for `api.test` swallowing every
  // request meant for anyone else, because its routes matched on path alone.
  const router = createRouter({ host: 'api.test' })
  router.all('/thing', ctx => { ctx.status = 200; ctx.body = 'routed' })
  const entry = entryFor(router)

  assert.equal((await entry('https://other.test/thing')).status, 599)
  assert.equal(await (await entry('https://api.test/thing')).text(), 'routed')
})

test('a host rule does not leak into the "path is claimed" answer', async () => {
  // Real failure this prevents: a request for another host answered 404/405
  // instead of being forwarded, because the router still claimed the path.
  const router = createRouter({ host: 'api.test' })
  router.use(router.allowedMethods())
  router.get('/thing', ctx => { ctx.status = 200 })
  const response = await entryFor(router)('https://other.test/thing')
  assert.equal(response.status, 599)
})

// ---------------------------------------------------------------- redirect

test('redirect answers with a Location and a negotiated body', async () => {
  const router = createRouter()
  router.get('home', '/home', ctx => { ctx.status = 200 })
  router.redirect('/old', 'home')
  const entry = entryFor(router)

  const plain = await entry('https://example.test/old')
  assert.equal(plain.status, 301)
  assert.equal(plain.headers.get('location'), '/home')

  const html = await entry('https://example.test/old', { headers: { accept: 'text/html' } })
  assert.match(await html.text(), /<a href="\/home">/)
})

// ------------------------------------------------------------- allowedMethods

test('the uncommon verbs are implemented, not answered with 501', async () => {
  // Real bug this pins: the method table used to hold only the eight common verbs,
  // so a PROPFIND route registered fine and then answered 501 to every request.
  const router = createRouter()
  router.use(router.allowedMethods())
  router.propfind('/doc', ctx => { ctx.status = 200; ctx.body = 'ok' })
  const entry = entryFor(router)

  assert.equal((await entry('https://example.test/doc', { method: 'PROPFIND' })).status, 200)
  const wrong = await entry('https://example.test/doc', { method: 'GET' })
  assert.equal(wrong.status, 405)
  assert.match(wrong.headers.get('allow') ?? '', /PROPFIND/)
})

// ---------------------------------------------------------- body rewriting

test('a middleware can rewrite the body that goes out', async () => {
  // The whole point of the middleware layer: a plugin gets to change what the model
  // sees. Covered in depth by the shape suite; this is the plain path.
  const router = createRouter()
  router.use(async (ctx, next) => {
    if (typeof ctx.requestBody === 'string') ctx.requestBody = ctx.requestBody.replace('secret', 'redacted')
    await next()
  })
  let sent = null
  const entry = createFetchEntry({
    router,
    network: async (request) => { sent = await request.text(); return new Response('ok') },
  })
  await entry('https://example.test/send', { method: 'POST', body: 'a secret here' })
  assert.equal(sent, 'a redacted here')
})

test('a rewrite happens even when no endpoint rule matches the host', async () => {
  // Real failure this prevents: the DeepSeek host had no endpoint rule, so the
  // rewrite never ran at all and the plugin silently did nothing.
  const router = createRouter()
  router.use(async (ctx, next) => {
    if (typeof ctx.requestBody === 'string') ctx.requestBody = ctx.requestBody.replace('原文', '改过')
    await next()
  })
  let sent = null
  const entry = createFetchEntry({
    router,
    network: async (request) => { sent = await request.text(); return new Response('ok') },
  })
  await entry('https://api.deepseek.com/chat/completions', { method: 'POST', body: '原文' })
  assert.equal(sent, '改过')
})
