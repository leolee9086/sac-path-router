/**
 * Request-shape tests for the fetch entry.
 *
 * These exist because a real regression slipped past the rest of the suite: making
 * every request go through the router (so a body-rewriting middleware can see all
 * of them) meant `new Request(input, init)` ran for every call, and the entry then
 * handed the *same* stream body to `send()` as well. The request consumed its body
 * twice and every call failed as a transport error — while 94 tests stayed green,
 * because every one of them passed a string body through `fetch(url, init)`.
 *
 * So this file fixes the *shape* of the input, not the router's behaviour: a
 * stream, a `Request` with the body inside it, a `FormData`, a null body, an
 * already-consumed-looking body. A test that only ever feeds one shape is a test
 * that can only ever find one kind of bug.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createFetchEntry, createRouter } from '../dist/index.js'

/**
 * An entry that captures what actually reaches the network.
 *
 * The body is read through `clone()` so the assertion cannot itself be the thing
 * that consumes the stream — which is exactly the bug these tests are for.
 */
function capture(options = {}) {
  const router = createRouter()
  if (options.rewrite !== undefined) {
    router.use(async (ctx, next) => {
      if (typeof ctx.requestBody === 'string') ctx.requestBody = options.rewrite(ctx.requestBody)
      await next()
    })
  }
  const seen = []
  const entry = createFetchEntry({
    router,
    network: async (request) => {
      const carries = request.method !== 'GET' && request.method !== 'HEAD'
      let body = null
      if (carries && request.body !== null) {
        body = await request.clone().text()
      }
      seen.push({ url: request.url, method: request.method, body, headers: request.headers })
      return new Response('upstream', { status: 200 })
    },
  })
  return { entry, seen, router }
}

// ------------------------------------------------------------ body shapes

test('a string body reaches the network exactly once', async () => {
  const { entry, seen } = capture()
  const response = await entry('https://example.test/x', { method: 'POST', body: 'plain string' })
  assert.equal(response.status, 200)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].body, 'plain string')
})

test('a stream body reaches the network intact (and is not consumed twice)', async () => {
  const { entry, seen } = capture()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('streamed body'))
      controller.close()
    },
  })
  const response = await entry('https://example.test/x', { method: 'POST', body: stream, duplex: 'half' })
  assert.equal(response.status, 200)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].body, 'streamed body')
})

test('a Request with its body inside reaches the network intact', async () => {
  const { entry, seen } = capture()
  const request = new Request('https://example.test/x', { method: 'POST', body: 'inside the request' })
  const response = await entry(request)
  assert.equal(response.status, 200)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].body, 'inside the request')
})

test('a Request with a stream body inside it survives too', async () => {
  const { entry, seen } = capture()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('stream inside request'))
      controller.close()
    },
  })
  const request = new Request('https://example.test/x', { method: 'POST', body: stream, duplex: 'half' })
  const response = await entry(request)
  assert.equal(response.status, 200)
  assert.equal(seen[0].body, 'stream inside request')
})

test('a Request plus an init uses the init', async () => {
  const { entry, seen } = capture()
  const request = new Request('https://example.test/x', { method: 'POST', body: 'from request' })
  const response = await entry(request, { method: 'POST', body: 'from init' })
  assert.equal(response.status, 200)
  assert.equal(seen[0].body, 'from init')
})

test('URLSearchParams, FormData and Blob bodies all arrive', async () => {
  const { entry, seen } = capture()
  await entry('https://example.test/form', { method: 'POST', body: new URLSearchParams({ a: '1' }) })
  await entry('https://example.test/multi', { method: 'POST', body: (() => { const f = new FormData(); f.set('k', 'v'); return f })() })
  await entry('https://example.test/blob', { method: 'POST', body: new Blob(['blobbed']) })
  assert.equal(seen.length, 3)
  assert.equal(seen[0].body, 'a=1')
  assert.match(seen[1].body ?? '', /name="k"/)
  assert.equal(seen[2].body, 'blobbed')
})

test('GET and HEAD carry no body', async () => {
  const { entry, seen } = capture()
  await entry('https://example.test/read')
  await entry('https://example.test/head', { method: 'HEAD' })
  assert.equal(seen.length, 2)
  assert.equal(seen[0].body, null)
  assert.equal(seen[1].body, null)
})

test('a URL object as input works like a string', async () => {
  const { entry, seen } = capture()
  await entry(new URL('https://example.test/from-url'), { method: 'POST', body: 'url input' })
  assert.equal(seen[0].url, 'https://example.test/from-url')
  assert.equal(seen[0].body, 'url input')
})

test('an explicit null body goes out as no body', async () => {
  const { entry, seen } = capture()
  await entry('https://example.test/x', { method: 'POST', body: null })
  assert.equal(seen[0].body, null)
})

// --------------------------------------------------- rewriting per shape

test('a rewrite applies to a string body', async () => {
  const { entry, seen } = capture({ rewrite: body => body.replace('原文', '改过') })
  await entry('https://example.test/x', { method: 'POST', body: '原文' })
  assert.equal(seen[0].body, '改过')
})

test('a rewrite applies to a body carried inside a Request', async () => {
  const { entry, seen } = capture({ rewrite: body => body.replace('原文', '改过') })
  await entry(new Request('https://example.test/x', { method: 'POST', body: '原文' }))
  assert.equal(seen[0].body, '改过')
})

test('a rewrite leaves a stream body alone', async () => {
  const { entry, seen } = capture({ rewrite: body => body.replace('原文', '改过') })
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('原文'))
      controller.close()
    },
  })
  await entry('https://example.test/x', { method: 'POST', body: stream, duplex: 'half' })
  // A stream is not a string, so it is not rewritten — and crucially not broken.
  assert.equal(seen[0].body, '原文')
})

test('a rewrite applies to a FormData body', async () => {
  const { entry, seen } = capture({ rewrite: body => body.replace('v', 'w') })
  const form = new FormData()
  form.set('k', 'v')
  await entry('https://example.test/x', { method: 'POST', body: form })
  // FormData is not a string: left alone, still delivered.
  assert.match(seen[0].body ?? '', /name="k"/)
})

// -------------------------------------------------------- internal redirect

test('a rewritten body survives an internal path hand-off', async () => {
  const { entry, seen, router } = capture({ rewrite: body => body.replace('原文', '改过') })
  // `all`, not `get`: the request below carries a body, so it is a POST.
  router.all('/start', async (ctx, next) => {
    ctx.path = '/finish'
    await next()
  })
  router.all('/finish', async (ctx) => {
    ctx.status = 200
    ctx.body = 'done'
  })
  const response = await entry('https://example.test/start', { method: 'POST', body: '原文' })
  assert.equal(await response.text(), 'done')
  assert.equal(seen.length, 0)
})

test('a rewritten body reaches the network after a hand-off to an unmatched path', async () => {
  const { entry, seen, router } = capture({ rewrite: body => body.replace('原文', '改过') })
  router.all('/hand-off', async (ctx, next) => {
    ctx.path = '/elsewhere'
    await next()
  })
  await entry('https://example.test/hand-off', { method: 'POST', body: '原文' })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].url, 'https://example.test/elsewhere')
  assert.equal(seen[0].body, '改过')
})
