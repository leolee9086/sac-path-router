/**
 * Koa dialect: the parts middleware actually reaches for.

 * The reference router shipped a full Koa context, so the contract is “what does
 * middleware in the wild call?” — `ctx.throw`, `ctx.accepts`, `ctx.redirect`,
 * `ctx.cookies`. Tests that only restate a getter's implementation are not here.
 *
 * Two names had to move because this context is a fetch context first: `ctx.set/get`
 * are response headers (Koa's meaning), outgoing request headers are
 * `setRequestHeader`/`getRequestHeader`. The test below exists because getting that
 * wrong sends a header to the wrong place, silently.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createApp, createKoaContext, KoaContext } from '../dist/koa/index.js'
import { HttpError, createRouter } from '../dist/index.js'

/** A context over a request with the given method, headers, and body. */
function contextFor(url = 'https://example.test/x', init = {}) {
  return createKoaContext(new Request(url, init))
}

/** Run one app over one request. */
async function run(app, url, init) {
  return app.fetch({ network: () => Promise.resolve(new Response('network', { status: 599 })) })(url, init)
}

// ------------------------------------------------------------- error helpers

test('ctx.throw raises an HTTP error, which is how auth middleware says 401', () => {
  const ctx = contextFor()
  assert.throws(() => ctx.throw(401, 'Authentication Error: No Token Provided'),
    (error) => error instanceof HttpError && error.status === 401)
  // The message must survive: a 401 with no reason is unactionable.
  assert.throws(() => ctx.throw(400, 'bad input'), (error) => error.message === 'bad input')
})

test('ctx.onerror answers with the status and hides 5xx messages', () => {
  // Real risk this prevents: leaking a 500's internals to the caller.
  const unauthorized = contextFor()
  unauthorized.onerror(new HttpError(401, 'no token'))
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.body, 'no token')

  const boom = contextFor()
  boom.onerror(new Error('database password is hunter2'))
  assert.equal(boom.status, 500)
  assert.equal(boom.body, 'Internal Server Error')
})

// ---------------------------------------------------------------- headers

test('ctx.set writes response headers; request headers have their own names', () => {
  const ctx = contextFor()
  ctx.set('X-One', 'a')
  assert.equal(ctx.responseHeaders.get('x-one'), 'a')
  ctx.append('X-One', 'b')
  assert.match(ctx.get('x-one'), /a/)
  assert.match(ctx.get('x-one'), /b/)

  ctx.setRequestHeader('x-opencode-session', 'abc')
  assert.equal(ctx.headers.get('x-opencode-session'), 'abc')
  // The two must not alias, or a session id ends up in a response header.
  assert.equal(ctx.responseHeaders.has('x-opencode-session'), false)
})

test('ctx.status rejects impossible codes and clears the body where none is allowed', () => {
  const ctx = contextFor()
  assert.throws(() => { ctx.status = 99 }, RangeError)
  ctx.body = 'something'
  ctx.status = 204
  assert.equal(ctx.body, null)
})

// --------------------------------------------------------- response helpers

test('ctx.redirect negotiates the body and honors back', () => {
  const plain = contextFor('https://example.test/old')
  plain.redirect('/new')
  assert.equal(plain.status, 302)
  assert.equal(plain.responseHeaders.get('location'), '/new')

  const back = contextFor('https://example.test/old', { headers: { referer: '/previous' } })
  back.redirect('back')
  assert.equal(back.responseHeaders.get('location'), '/previous')
})

test('ctx.type, etag, vary and attachment write the headers they promise', () => {
  const ctx = contextFor()
  ctx.type = 'json'
  assert.equal(ctx.get('content-type'), 'json')
  ctx.etag = 'abc'
  assert.equal(ctx.get('etag'), '"abc"')
  ctx.vary('Accept')
  ctx.vary('Accept')
  assert.equal(ctx.get('vary'), 'Accept')
  ctx.attachment('report.txt')
  assert.match(ctx.get('content-disposition'), /report\.txt/)
})

test('ctx.accepts picks a type the client will take, or says no', () => {
  const html = contextFor('https://example.test/x', { headers: { accept: 'text/html' } })
  assert.equal(html.accepts('html'), 'text/html')
  assert.equal(html.accepts('json'), false)
  // `*/*` is the common case from SDKs and must match anything offered.
  const any = contextFor('https://example.test/x', { headers: { accept: '*/*' } })
  assert.equal(any.accepts('json'), 'application/json')
})

test('cookies parse the request and queue Set-Cookie on the response', () => {
  const ctx = contextFor('https://example.test/x', { headers: { cookie: 'a=1; b=hello%20world' } })
  assert.equal(ctx.cookies.get('b'), 'hello world')
  ctx.cookies.set('session', 's1')
  assert.match(ctx.responseHeaders.getSetCookie()[0], /^session=s1/)
  // HttpOnly by default: a session cookie without it is a real vulnerability.
  assert.match(ctx.responseHeaders.getSetCookie()[0], /HttpOnly/)
})

// ---------------------------------------------------------- the application

test('a thrown error reaches the caller with its status', async () => {
  const app = createApp()
  app.get('/guard', (ctx) => { ctx.throw(403, 'not yours') })
  await assert.rejects(() => run(app, 'https://example.test/guard'), (error) => error.status === 403)
})

test('a route gets a Koa context, so middleware from Koa works unchanged', async () => {
  const app = createApp()
  let isKoa = null
  app.get('/who', (ctx) => { isKoa = ctx instanceof KoaContext; ctx.status = 200; ctx.body = 'hello' })
  const response = await run(app, 'https://example.test/who')
  assert.equal(await response.text(), 'hello')
  assert.equal(isKoa, true)
})

test('the application reports errors through its own event', async () => {
  // Error middleware in the reference codebase listened on exactly this.
  const app = createApp()
  const seen = []
  app.on('error', (error) => seen.push(error))
  app.get('/boom', (ctx) => { ctx.onerror(new Error('kaboom')) })
  await run(app, 'https://example.test/boom')
  assert.equal(seen.length, 1)
  assert.equal(String(seen[0]), 'Error: kaboom')
})

test('query and path read the target the way middleware expects', () => {
  const ctx = contextFor('https://example.test/a/b?x=1&y=2')
  assert.deepEqual(ctx.query, { x: '1', y: '2' })
  assert.equal(ctx.path, '/a/b')
  ctx.querystring = 'z=3'
  assert.deepEqual(ctx.query, { z: '3' })
  assert.equal(ctx.path, '/a/b')
})
