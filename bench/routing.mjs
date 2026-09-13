/**
 * Routing benchmark: registration cost and dispatch cost for both matchers.
 *
 * Run with `node bench/routing.mjs [routeCount...]`; defaults to 1000 and 5000.
 * Numbers are indicative — this measures the router, not the network.
 */
import { performance } from 'node:perf_hooks'
import { createFetchEntry, createRouter } from '../dist/index.js'

const sizes = process.argv.slice(2).map(Number).filter(Number.isFinite)
const ROUTE_COUNTS = sizes.length > 0 ? sizes : [1000, 5000]
const ITERATIONS = 20_000

/** Build a route table of `count` routes and time registration. */
function build(matcher, count) {
  const started = performance.now()
  const router = createRouter({ matcher })
  for (let i = 0; i < count; i += 1) {
    router.get(`/api/v${i % 4}/resource-${i}/:id`, ctx => { ctx.status = 200; ctx.body = ctx.params.id })
  }
  const registrationMs = performance.now() - started
  const entry = createFetchEntry({ router, network: () => Promise.resolve(new Response('upstream', { status: 599 })) })
  return { entry, registrationMs }
}

/** Time `iterations` dispatches, returning microseconds per call. */
async function measure(entry, urls, iterations) {
  // Warm up so the first calls do not carry module-level lazy work.
  for (let i = 0; i < 500; i += 1) await entry(urls[i % urls.length])
  const started = performance.now()
  for (let i = 0; i < iterations; i += 1) await entry(urls[i % urls.length])
  return ((performance.now() - started) * 1000) / iterations
}

const rows = []
for (const count of ROUTE_COUNTS) {
  for (const matcher of ['regexp', 'radix3']) {
    const { entry, registrationMs } = build(matcher, count)
    const hits = [
      `https://bench.test/api/v0/resource-0/1`,
      `https://bench.test/api/v${(count - 1) % 4}/resource-${count - 1}/1`,
      `https://bench.test/api/v1/resource-${Math.floor(count / 2)}/1`,
    ]
    const hitUs = await measure(entry, hits, ITERATIONS)
    const missUs = await measure(entry, ['https://bench.test/not/claimed/path'], ITERATIONS)
    rows.push({ count, matcher, registrationMs, hitUs, missUs })
  }
}

const pad = (value, width) => String(value).padStart(width)
console.log(`${pad('routes', 7)} ${pad('matcher', 8)} ${pad('register ms', 12)} ${pad('hit µs', 9)} ${pad('miss µs', 9)}`)
for (const row of rows) {
  console.log(`${pad(row.count, 7)} ${pad(row.matcher, 8)} ${pad(row.registrationMs.toFixed(1), 12)} ${pad(row.hitUs.toFixed(1), 9)} ${pad(row.missUs.toFixed(1), 9)}`)
}

for (const count of ROUTE_COUNTS) {
  const regexp = rows.find(row => row.count === count && row.matcher === 'regexp')
  const radix = rows.find(row => row.count === count && row.matcher === 'radix3')
  if (regexp === undefined || radix === undefined) continue
  console.log(
    `${count} routes: hit ${(regexp.hitUs / radix.hitUs).toFixed(1)}x,`
    + ` miss ${(regexp.missUs / radix.missUs).toFixed(1)}x in radix3's favour`,
  )
}
