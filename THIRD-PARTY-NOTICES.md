# Third-party notices

`sac-path-router` is MIT-licensed (see [LICENSE](./LICENSE)). Parts of it are
**derived from MIT-licensed libraries**, so their copyright notices and
permission notices are reproduced here, as those licenses require.

## Code derived from other projects

| This repository | Derived from | What was taken |
|---|---|---|
| `src/core/compose.ts` | [koa-compose](https://github.com/koajs/compose) | the composition algorithm: the `index` guard, `dispatch(i)`, the `next() called multiple times` contract |
| `src/core/layer.ts` | [@koa/router](https://github.com/koajs/router) `lib/layer.js` | `setPrefix`, `captures`, `params`, the parameter-handler injection order, `safeDecodeURIComponent` |
| `src/core/router.ts` | [@koa/router](https://github.com/koajs/router) `lib/router.js` | `register`, `use` (pathless `([^/]*)` layers, prefix mounts), `routes()` dispatch, `allowedMethods`, named routes, the `GET`-implies-`HEAD` rule, the `matched.path` / `pathAndMethod` / `route` shape |
| `src/express/index.ts` | [Express](https://github.com/expressjs/express) `lib/router` | `Layer`, `Route`, `handle` walk, parameter handling, the four-argument error-middleware convention, the method list |
| `src/express/response.ts` | [Express](https://github.com/expressjs/express) | `res.status/set/append/type/json/send/end/redirect/sendStatus/cookie/clearCookie/vary/links/format` semantics |
| `src/core/matchers.ts` (`Radix3Matcher`) | the author's own `webKoa` `forKoaLikeRouter.js` | the "radix tree hit, otherwise registration-order regexp scan" shape |

Everything else — `src/core/context.ts`, `src/core/fetch-entry.ts`,
`src/core/matchers.ts` (`RegexpMatcher` and the matcher seam),
`src/node/index.ts`, `src/express/types.ts`, the tests, and the benchmark — is
original to this repository.

## Licenses of the above

### koa-compose

```
The MIT License (MIT)

Copyright (c) 2013 TJ Holowaychuk tj@apex.sh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### @koa/router

```
The MIT License (MIT)

Copyright (c) 2015 @koajs maintainers and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Express

```
(The MIT License)

Copyright (c) 2009-2014 TJ Holowaychuk <tj@vision-media.ca>
Copyright (c) 2013-2014 Roman Shtylman <shtylman+expressjs@gmail.com>
Copyright (c) 2014-2015 Douglas Christopher Wilson <doug@somethingdoug.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Runtime dependencies

These are installed as ordinary dependencies and ship with their own licenses;
no source from them is vendored into this repository.

| Package | License |
|---|---|
| [path-to-regexp](https://github.com/pillarjs/path-to-regexp) | MIT |
| [radix3](https://github.com/unjs/radix3) | MIT |
