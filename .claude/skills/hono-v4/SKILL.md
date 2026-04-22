---
name: hono-v4
description: >
  Hono v4 web framework reference. Auto-loads when working with Hono routes,
  middleware, hono-openapi, validator, streamSSE, HTTPException, hono/factory, RPC client.
user-invocable: false
updated: 2026-04-13
---

# Hono Reference

> **Version:** 4.x
> **Docs:** https://hono.dev/docs/

## Imports

```typescript
// Core
import { Hono } from 'hono'
import type { Context, ErrorHandler } from 'hono'

// Middleware
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

// OpenAPI validation & documentation (hono-openapi — preferred over raw zValidator)
import { describeRoute, openAPIRouteHandler, resolver, validator } from 'hono-openapi'

// SSE
import { streamSSE } from 'hono/streaming'
import type { SSEMessage, SSEStreamingApi } from 'hono/streaming'

// RPC
import { hc } from 'hono/client'
import type { InferRequestType, InferResponseType } from 'hono/client'

// Error handling
import { HTTPException } from 'hono/http-exception'

// Factory pattern
import { createMiddleware } from 'hono/factory'
import { createFactory } from 'hono/factory'

// Node.js adapter
import { serve } from '@hono/node-server'
import type { HttpBindings } from '@hono/node-server'
```

## API Quick Reference

### App Creation

```typescript
const app = new Hono()
const app = new Hono<{ Bindings: B; Variables: V }>()  // Typed
```

### Route Definition

```typescript
app.get(path, ...handlers)
app.post(path, ...handlers)
app.put(path, ...handlers)
app.delete(path, ...handlers)
app.patch(path, ...handlers)
app.all(path, ...handlers)
app.on(method, path, ...handlers)

// Chaining
app.get(path, handler).post(path, handler)

// Route groups
app.route(prefix, subApp)

// Base path
app.basePath(prefix)
```

### Context Methods

```typescript
// Request
c.req.param(key)           // Path param
c.req.param()              // All params
c.req.query(key)           // Query param
c.req.header(key)          // Header
c.req.json()               // Body as JSON (async)
c.req.valid(target)        // Validated data (after validator)
c.req.raw                  // Raw Request object

// Response
c.json(data, status?)      // JSON response
c.text(text, status?)      // Text response
c.html(html, status?)      // HTML response
c.body(body, status?)      // Raw body
c.redirect(url, status?)   // Redirect
c.notFound()               // 404

// Headers & Status
c.status(code)             // Set status
c.header(key, value)       // Set header

// Variables
c.set(key, value)          // Set context variable
c.get(key)                 // Get context variable
c.var                      // Typed access (with Variables generic)
```

### Validation & OpenAPI (hono-openapi)

Use `hono-openapi` for combined validation + OpenAPI documentation. This replaces raw `zValidator`.

```typescript
import { describeRoute, openAPIRouteHandler, resolver, validator } from 'hono-openapi'
import { z } from 'zod'

// Shared error response schemas (define once, reuse across routes)
const ErrorResponse = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
})

const ERROR_400 = {
  description: 'Validation error',
  content: { 'application/json': { schema: resolver(ErrorResponse) } },
} as const

const ERROR_401 = {
  description: 'Unauthenticated',
  content: { 'application/json': { schema: resolver(ErrorResponse) } },
} as const

// Route with describeRoute + validator
app.post(
  '/items',
  describeRoute({
    description: 'Create a new item',
    tags: ['items'],
    responses: {
      200: {
        description: 'Item created',
        content: { 'application/json': { schema: resolver(ItemResponseSchema) } },
      },
      400: ERROR_400,
      401: ERROR_401,
    },
  }),
  validator('json', CreateItemSchema),
  async (c) => {
    const data = c.req.valid('json')
    // ...
    return c.json(item)
  },
)

// Param and query validation
app.get(
  '/items/:id',
  describeRoute({ /* ... */ }),
  validator('param', z.object({ id: z.string().uuid() })),
  validator('query', z.object({ fields: z.string().optional() })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { fields } = c.req.valid('query')
    // ...
  },
)

// Validation targets: 'json' | 'form' | 'query' | 'param' | 'header' | 'cookie'

// resolver() converts Zod schema to JSON Schema for OpenAPI docs
resolver(ZodSchema)

// Generate OpenAPI spec from all describeRoute() definitions
app.get('/api/openapi.json', openAPIRouteHandler(app, {
  documentation: {
    info: { title: 'API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  },
}))
```

### Middleware

```typescript
// Global middleware
app.use(middleware)
app.use('*', middleware)

// Path-specific
app.use('/api/*', middleware)

// Inline middleware
app.use(async (c, next) => {
  // before handler
  await next()
  // after handler
})

// Reusable middleware with createMiddleware
const myMiddleware = createMiddleware<{ Variables: V }>(async (c, next) => {
  c.set('key', value)
  await next()
})
```

### Error Handling

```typescript
// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  return c.json({ error: 'Internal error' }, 500)
})

// Throw HTTPException
throw new HTTPException(statusCode, { message: 'Error message' })
throw new HTTPException(statusCode, { res: customResponse })
throw new HTTPException(statusCode, { message: 'Error', cause: originalError })
```

### SSE (Server-Sent Events)

```typescript
app.get('/sse', (c) => {
  return streamSSE(c, async (stream) => {
    let running = true

    stream.onAbort(() => {
      running = false
    })

    // Send messages
    await stream.writeSSE({
      data: JSON.stringify(payload),
      event: 'event-name',  // Optional
      id: String(id),        // Optional
    })

    // Keep connection alive (REQUIRED)
    while (running) {
      await stream.sleep(30000)
      if (running) {
        await stream.write(': heartbeat\n\n')
      }
    }
  })
})

// SSEMessage type
interface SSEMessage {
  data: string | Promise<string>
  event?: string
  id?: string
  retry?: number
}

// SSEStreamingApi methods
stream.writeSSE(message: SSEMessage): Promise<void>
stream.sleep(ms: number): Promise<void>
stream.onAbort(callback: () => void | Promise<void>): void
stream.write(data: string): Promise<void>
stream.abort(): void
```

### Type Export (for RPC)

```typescript
export default app
export type AppType = typeof app

// For modular apps
const routes = app.route('/api', apiRoutes)
export type AppType = typeof routes
```

### Node.js Server

```typescript
import { serve } from '@hono/node-server'

serve({
  fetch: app.fetch,
  port: 8080,
})
```

### WebSocket (Node.js via @hono/node-ws)

```typescript
// ws.ts — Initialize once during app setup
import { createNodeWebSocket } from '@hono/node-ws'
import type { Hono } from 'hono'
import type { UpgradeWebSocket } from 'hono/ws'

let _nodeWs: ReturnType<typeof createNodeWebSocket> | null = null

export const initWebSocket = (app: Hono) => {
  _nodeWs = createNodeWebSocket({ app })
}

export const upgradeWebSocket: UpgradeWebSocket = (...args) => {
  if (!_nodeWs) throw new Error('WebSocket not initialized')
  return _nodeWs.upgradeWebSocket(...args)
}

export const injectWebSocket = (server: Server) => {
  if (!_nodeWs) throw new Error('WebSocket not initialized')
  _nodeWs.injectWebSocket(server)
}

// app.ts — Call during setup
initWebSocket(app)

// server.ts — Inject after HTTP server created
injectWebSocket(server)

// Route usage — upgradeWebSocket returns a handler
import { upgradeWebSocket } from '../ws.js'

app.get(
  '/ws',
  upgradeWebSocket((c) => ({
    onOpen(event, ws) { /* client connected */ },
    onMessage(event, ws) {
      const data = typeof event.data === 'string' ? event.data : ''
      // handle message
    },
    onClose() { /* client disconnected */ },
  })),
)
```

## Gotchas & Version Caveats

**Validators must be inline** - Type inference breaks if validator is in `app.use()`. Always inline with handler.

**SSE requires await** - Callback must await something (sleep, loop) or connection closes immediately.

**Avoid c.notFound() with RPC** - Response types can't be inferred. Use explicit `c.json({ error }, 404)`.

**Status codes must be literals** - `c.json(data, 200)` not `c.json(data, status)` for proper RPC typing.

**Context variables need typing** - Use `Hono<{ Variables: V }>` for typed `c.get()` / `c.var`.

**Headers are auto-set for SSE** - `streamSSE` sets `Content-Type`, `Cache-Control`, `Connection` automatically.

**Middleware execution is stack-based** - Each middleware's post-`await next()` code runs in reverse order.

**TypeScript strict mode required** - Set `"strict": true` in tsconfig for proper RPC type inference.

**Path params regex validation** - Use `/:param{regex}` syntax for validation (e.g., `/:id{[0-9]+}`).

**EventEmitter doesn't keep SSE alive** - Must use infinite loop with heartbeats even with event-driven patterns.

## Anti-Patterns

**Don't use app.use() for validators:**
```typescript
// Bad - types break
app.use(validator('json', schema))
app.post('/posts', (c) => {
  const data = c.req.valid('json')  // Type error
})

// Good - inline with handler
app.post('/posts', validator('json', schema), (c) => {
  const data = c.req.valid('json')  // Typed
})
```

**Don't return c.notFound() with RPC:**
```typescript
// Bad - RPC can't infer types
if (!post) return c.notFound()

// Good - explicit JSON response
if (!post) return c.json({ error: 'not found' }, 404)
```

**Don't forget await in SSE callback:**
```typescript
// Bad - connection closes immediately
return streamSSE(c, async (stream) => {
  stream.writeSSE({ data: 'hello' })
})

// Good - keep connection alive
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: 'hello' })
  while (running) await stream.sleep(30000)
})
```

**Don't separate route handlers into controllers:**
```typescript
// Bad - path param types lost
export const getPost = (c: Context) => { /* ... */ }
app.get('/posts/:id', getPost)

// Good - inline handler or factory
app.get('/posts/:id', (c) => {
  const id = c.req.param('id')  // Typed
})
```

**Don't use dynamic status codes with RPC:**
```typescript
// Bad - breaks RPC type inference
const status = success ? 200 : 400
return c.json(data, status)

// Good - explicit literal status codes
if (!success) return c.json(data, 400)
return c.json(data, 200)
```

**Don't skip middleware for wildcard paths:**
```typescript
// Bad - wildcard paths don't inherit
app.use('/api/jobs', dbMiddleware)
app.route('/api/jobs', jobsRoutes)  // /api/jobs/:id won't have middleware

// Good - apply to both root and wildcard
app.use('/api/jobs', dbMiddleware)
app.use('/api/jobs/*', dbMiddleware)
app.route('/api/jobs', jobsRoutes)
```
