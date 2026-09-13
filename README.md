# sac-path-router

通用路由器：**以 fetch 为入口**，同一套路由既能跑 Koa 风格的 `(ctx, next)`，也能跑 Express 风格的 `(req, res, next)`；核心只用 Web 标准（`Request` / `Response` / `Headers` / `URL` / `AbortSignal`），因此**浏览器与 Node 通用**。

> Universal router with a fetch entry: Koa-style and Express-style routing over web-standard `Request`/`Response`, for browsers and Node.

```bash
pnpm add sac-path-router
```

## 为什么是"fetch 入口"

普通路由库的入口是 `(req, res)` 或 HTTP server；这里的入口是 `fetch`：

```js
import { createRouter, createFetchEntry } from 'sac-path-router'

const router = createRouter()
router.get('/users/:id', ctx => { ctx.status = 200; ctx.body = { id: ctx.params.id } })

const entry = createFetchEntry({
  router,
  network: globalThis.fetch,          // 没被路由命中的请求照常出网
})

await entry('https://api.test/users/7')     // → 200，本地应答，不出网
await entry('https://api.test/other')       // → 交给 network
```

这让它天然是一个**进程内拦截器**：命中的请求被路由接管，未命中的原样透传；`network` 就是唯一的出口，没有隐式兜底。

## 三个入口

| 入口 | 内容 |
|---|---|
| `sac-path-router` | 核心：`compose`、`Layer`、`Router`（ctx 形状）、`createContext`、`createFetchEntry` |
| `sac-path-router/koa` | Koa 方言：`createApp`、`Application`（全局中间件 + 路由器）、`allowedMethods` |
| `sac-path-router/express` | Express 方言：`createRouter`、`Route`、`ResponseBuilder`（`res.json/send/redirect`）、错误中间件 |
| `sac-path-router/node` | Node 适配：`serve`、`createServer`、`toFetchRequest`、`writeFetchResponse` |

`sac-path-router/node` 是唯一引入 Node 内置模块的入口，其余入口在浏览器里可直接加载。

## Koa 风格

```js
import { createApp } from 'sac-path-router/koa'

const app = createApp()
app.use(app.allowedMethods())
app.group('/api', api => {
  api.get('user', '/users/:id', async ctx => {
    await next()                      // 需要时继续；不调用则本地应答
    ctx.status = 200
    ctx.body = `user ${ctx.params.id}`
  })
})

const response = await app.fetch({ network: fetch })('https://host/api/users/9')
```

- `ctx.params` / `ctx.query` / `ctx.path`（可写：写入即触发**内部重派**，有重派上限）
- `ctx.state.scope`：宿主在路由前挂上的请求作用域（例如 `{ provider, model, sessionId }`）
- `ctx.set(name, value)`：设置**出网请求**头；`ctx.responseHeaders`：设置本地响应头
- 命名路由 `router.url('user', { id: 5 })`、`router.group(prefix, fn)`、`router.use(path?, ...)`、`router.param(name, fn)`

## Express 风格

```js
import { createRouter } from 'sac-path-router/express'

const router = createRouter()
router.use('/api', apiRouter)                       // 挂载会剥掉前缀
router.get('/users/:id', (req, res) => res.json({ id: req.params.id }))
router.route('/multi').get(a).post(b)               // 路由构建器
router.use((error, req, res, next) => res.status(500).json({ message: error.message }))
```

`req` 是 Web `Request` + `params`/`query`/`path`/`get()`；`res` 是响应构建器（`status/set/type/json/send/end/redirect`），结束时物化成标准 `Response`。

## 浏览器 / Node 通用

- 核心与两个方言只用 Web 标准，不 import `node:*`
- `fetch`、`Request`、`Response`、`AbortSignal` 在 Node 18.17+ 与所有现代浏览器都存在
- Node 服务端：`import { serve } from 'sac-path-router/node'`，或把 `createFetchEntry(...)` 交给任意支持 fetch handler 的运行时

## 已规避的常见路由库问题

| 类别 | 处理 |
|---|---|
| 原型污染（`__proto__`/`constructor`/`prototype` 作为参数名） | 参数一律以自身数据属性写入（`Object.defineProperty`），不经过原型链 —— 见 `test/robustness.test.js` |
| 前缀边界（`use('/api')` 误匹配 `/apix`） | 段边界匹配，`/api`、`/api/x` 命中，`/apix` 不命中 |
| 查询串参与匹配 | 只用 pathname 匹配 |
| 响应后再写（"headers already sent"） | 已有响应时后续层不再启动；已启动中间件的后置逻辑仍会执行 |
| `HEAD` 带 body | 保留 GET 的头，剥掉 body（本地应答与透传都处理） |
| 取消传播 | 请求 `signal` 原样传给 `network`；Node 适配器把 abort 视为断开而非 500 |
| 畸形百分号编码 | 捕获保持原文，不抛 400、不崩 |
| `next()` 重复调用 | compose 拒绝 |
| 参数处理器重复执行（Express） | 按 (name, value) 去重 |
| 挂载共享层栈 | 挂载时复制中间件栈，同一路由器可挂到多个前缀 |
| Koa 状态默认值 | 只设 body 未设 status 时按 200 应答，而不是 404 |
| 内部重派死循环 | 重写 `ctx.path` 有重派上限（默认 5，可配） |
| 未命中语义含糊 | 明确：路径被某条**路由**认领 → 归路由器（可 405）；否则原样出网 |

## 来源与许可

本项目从作者既有的 **webKoa** 实现抽离并统一而来 —— 即 `SiyuanAssistantCollection` / `SACAssetsManager` 中的 Koa 全量移植、koa-router 移植、`internalFetch`，以及 `useDeps/useRadix3` 下的两支 radix3 路由器。

- 自有代码：**MIT**（见 [LICENSE](./LICENSE)）
- 运行依赖：`path-to-regexp`（MIT），未内联任何第三方源码
- API 形状参考 Koa（MIT）、koa-router（MIT）、Express（MIT），实现为自研

## 与既有 webKoa 的关系

- 保留：`compose` 语义、`Layer`/参数捕获、`router.use/routes/param/prefix`、`internalFetch` 的"fetch 语义入口 + `ctx.path` 改写重派"
- 统一：原来的"koa 一支（path-to-regexp）"与"express 一支（radix3 匹配 + `res.end`）"合并到同一层注册表与匹配器之上
- 丢弃：HTTP server 外壳（`listen`/`respond`）、浏览器 shim（`cookies`/`delegates`/`http-assert`/`statuses` 等）
- 改进：`AbortSignal` 原生传播（不再 `Promise.race` 造 rejection）、重派有上限、响应后再写被拦、HEAD/原型污染等加固

## 匹配器：`matcher: 'regexp' | 'radix3'`

```js
import { createRouter } from 'sac-path-router'

createRouter()                    // 默认：按注册顺序扫描，Koa 的调度契约
createRouter({ matcher: 'radix3' })  // 前缀树索引，按方法取"最具体"的那条
```

| | `regexp`（默认） | `radix3` |
|---|---|---|
| 匹配方式 | 每条路由的正则逐个测试 | 每方法一棵 radix 前缀树 + 一条"认领树" |
| 命中语义 | 注册顺序，全部命中都跑 | 最具体的一条（`/users/me` 胜过 `/users/:id`），无路径中间件先跑 |
| 通配 | path-to-regexp：`(.*)`、`:rest+` | radix：`*`（单段）、`**`（剩余全部）；**正则写法仍可用**（自动走扫描回退） |
| 未命中开销 | O(路由数) | O(路径长度) |
| 适用 | 路由少、需要多层叠加 | 路由多（1000+）、拦截器场景 |

`radix3` 模式下 `**` 等 radix 写法无法交给 `path-to-regexp` 编译，`Layer` 会容忍这类模式并把匹配权交给匹配器；参数由树返回。两种匹配器的行为一致性由 `test/matchers.test.js` 覆盖（同一张路由表，两边断言相同）。

### 基准

```bash
pnpm bench          # 默认 1000 与 5000 条路由
pnpm bench 1000 5000 20000
```

本机（Node 22.19 / Windows，20k 次派发取均值，含 fetch 入口的 Request/Response 分配）：

| 路由数 | 匹配器 | 注册 ms | 命中 µs | 未命中 µs |
|---|---|---|---|---|
| 1000 | regexp | 29.3 | 189.5 | 250.1 |
| 1000 | radix3 | 35.6 | 24.2 | 28.8 |
| 5000 | regexp | 69.4 | 2030.8 | 1905.1 |
| 5000 | radix3 | 60.7 | 18.0 | 17.9 |

5000 条路由下命中快 **113×**、未命中快 **106×**（radix3 的命中/未命中成本基本不随路由数增长）。CI 会跑一遍基准并打印数字，但**不设阈值** —— 共享 runner 的抖动会让阈值变成随机红灯，性能回归靠人看这张表。

## 路线图

- [ ] 更多方言：`sac-path-router/fastify`（`(request, reply)`）—— 尚未实现，不是"半成品"：目前只有 koa/express 两种 handler 形状
- [ ] Express 兼容度继续补齐：`app.set`/`app.locals`（应用级，属）与 `res.sendFile`（需要文件系统访问，故意不做进通用核心）
- [ ] 多方法混合注册的 radix 索引优化：`router.all('/x')` 目前落在共享树，可按需再拆

## 开发

```bash
pnpm install
pnpm build        # tsc → dist（ESM + d.ts）
pnpm test         # node --test（自动发现 test/*.test.js）
pnpm bench        # 两个匹配器的路由基准
pnpm check        # typecheck + build + test
```

> 受限沙箱里 `node --test` 需要派生子进程，可能被拒绝；此时可逐个文件直接执行：`node test/router.test.js && node test/robustness.test.js`（结果等价）。

## License

MIT
