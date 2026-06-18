---
source_handle: hono-src-4-12-8
source_class: github-readme
fetched: 2026-06-18
source_path: platform/.research/reference/input/hono (git tag v4.12.12 @ commit c37ba26)
source_url: https://github.com/honojs/hono
provenance: source-direct
version: v4.12.12
---

# Hono v4.12.12 — source attestation

Cloned at tag `v4.12.12` (lockfile resolution: `hono@4.12.12`; tag v4.12.8 does not exist;
nearest exact tag matching the lockfile pin is `v4.12.12`). Commit `c37ba26`.

## Core dispatch — hono-base.ts

`HonoBase` is the parent class. The per-method HTTP verb methods (`get`, `post`, etc.) are
defined dynamically in the constructor by iterating `METHODS` (hono-base.ts:128–141). Each call
chains via `this.#addRoute`, which stores a `RouterRoute = { basePath, path, method, handler }`.
`app.onError(handler)` replaces the private `errorHandler` field (hono-base.ts:271–274); the
default `errorHandler` at module-top level (hono-base.ts:35–42) passes `HTTPException` responses
through via `err.getResponse()` and falls back to a plain 500 text response. The Hono base class
does **not** auto-catch `AppError` subclasses — the default catch is exclusively for anything
with a `.getResponse()` method (i.e. `HTTPException`).

## Context — context.ts

`c.set(key, value)` and `c.get(key)` are typed by the `E['Variables']` generic (context.ts:546–580).
The `c.var` getter returns `Object.fromEntries(this.#var)` as a typed Readonly object
(context.ts:593–602). Both paths resolve against `ContextVariableMap` (an open interface at
context.ts:57) and `E['Variables']`. This means typed context variables require the Hono instance
or middleware to be parameterized with a `Variables` map — the source directly shows this typing
lives on the Hono generic, not as a runtime injection mechanism.

## Factory helper — src/helper/factory/index.ts

`createFactory<E>({ initApp?, defaultAppOptions? })` returns a `Factory<E>` instance with three
methods (factory/index.ts:332–375):
- `createApp(options?)` — creates a `new Hono<E>()`, runs `initApp(app)` if supplied.
- `createMiddleware<I, R>(middleware)` — identity function; its value is type inference only
  (lines 353–355: `middleware => middleware`). Returns the same middleware unchanged.
- `createHandlers(...handlers)` — filters out undefined handlers; again the value is type
  propagation across up to 10 chained handlers with correctly accumulated `Input` types.

The top-level `createMiddleware` export (factory/index.ts:368–375) is also an identity function.
Neither `createFactory` nor `createMiddleware` add runtime behavior; they exist entirely for
TypeScript type inference.

## Built-in validator — src/validator/validator.ts

`validator(target, validationFunc)` is a `MiddlewareHandler` factory (validator.ts:46–172). It
extracts the raw value for the named target (`json`, `form`, `query`, `param`, `header`,
`cookie`), calls `validationFunc(value, c)`, then calls `c.req.addValidatedData(target, res)`.
After that it calls `await next()`. The `validationFunc` receives the raw extracted value and must
return either the validated output OR a `Response` to short-circuit.

The `validator` from `hono` core and the `validator` from `hono-openapi` (v1.3.0 per lockfile)
are different functions: hono-openapi's `validator` wraps the core one and adds Zod/Standard
Schema execution and error handling. After calling `hono-openapi`'s `validator`, `c.req.valid(target)`
returns the Zod-parsed output — typed to the schema output type via the Hono `Input` generic.

`c.req.valid(target)` is typed by the `Input` generic accumulated across validator middleware.
The type inference chain depends on the `Hono<E, S>` schema generic accumulating the validators'
`Input` types at registration time (static type inference, not runtime).

## HTTPException — src/http-exception.ts

`HTTPException(status, { res?, message?, cause? })` (http-exception.ts:55–78). `getResponse()`
returns the `res` if supplied, else `new Response(this.message, { status })`. The default
`errorHandler` in hono-base.ts calls `err.getResponse()` if `'getResponse' in err`.

## RPC client — src/client/client.ts, src/client/index.ts

`hc<T extends Hono>(baseUrl, options?)` builds a typed Proxy tree from the Hono app's inferred
schema type `T` (client.ts:133+). The types flow from the `typeof app` — specifically from the
schema generic `S` accumulated by `app.route()` chaining. This means: (a) the client receives
types only for routes whose handlers are registered directly on the chained `Hono` instance whose
type is exported; (b) routes mounted with `app.route(path, subApp)` accumulate into `S` via
`MergeSchemaPath`; (c) feature-gated or dynamically-imported routes whose registration is
conditional will be absent from the inferred `S` if not reachable from the static code path.

## Built-in middleware inventory — src/middleware/

Included middleware (relevant to our stack):
- `bearer-auth` — validates `Authorization: Bearer <token>` header; supports string/array tokens
  or a `verifyToken` async callback; uses timing-safe comparison (bearer-auth/index.ts:1–218).
- `cors` — CORS middleware.
- `logger` — request logging.
- `jwt` — JWT verification.
- `timeout` — request timeout.
- `rate-limit` — rate limiting.
- `ip-restriction` — IP allowlist/denylist.
- `secure-headers` — security headers.
- `request-id` — request ID header.
- `combine` — middleware combinator utilities (`some`, `every`, `except`).
- `context-storage` — async-context storage for accessing context outside handlers.
- `csrf` — CSRF protection.

Notable: there is **no** built-in session/cookie-based auth middleware in Hono core. The auth
pattern (session lookup, role extraction) is left to application code.

## Key observations for gap analysis

1. `createMiddleware` is a pure type-inference identity — calling it wraps no runtime behavior.
   Its only value is forwarding the `E['Variables']` generic so `c.set`/`c.get` are typed inside
   the middleware body.

2. The Hono default error handler ONLY handles `HTTPException` (anything with `.getResponse()`).
   It does not handle custom `AppError` subclasses that lack `.getResponse()` — those fall to the
   plain 500 text path.

3. `c.req.valid(target)` returns the correct output type when `validator()` is placed inline as a
   route argument (so the schema type propagates into the route handler's `Input` generic).
   When `validator()` is used elsewhere (e.g. in `app.use()`), the type does NOT propagate
   (confirmed by the skill's own gotcha note and by how the `Input` generic accumulation works at
   hono-base.ts:128–141 — `use()` goes through `METHOD_NAME_ALL` and does not contribute to the
   route's `Input` generic).

4. `hono-openapi`'s `validator` (used in our codebase) wraps Hono's core `validator`. Calling it
   inline on a route propagates the validated `Input` type into that route's handler **via the
   method-chain overload, not via the instance's `S` generic** — so `c.req.valid(target)` is
   correctly typed even on a bare `new Hono<AuthEnv>()` instance (no `S` specified). **Corrected
   2026-06-18** (the prior draft of this observation claimed the bare instance forces
   `c.req.valid` to return `unknown`, requiring an `as never` cast): an adversarial verification
   pass stripped every `as never` cast from `apps/api/src/routes/content-media.routes.ts` and
   `playout.routes.ts` and `tsc --noEmit` on `@snc/api` still passed (exit 0); seven route files
   already use `valid("param")` / `valid("json")` with no cast at all (e.g. `follow.routes.ts`,
   `invite.routes.ts`, `playout-channels.routes.ts`). The `as never` casts in our routes (122
   occurrences) are therefore **vestigial/redundant**, not a required workaround — a cleanup
   opportunity, not a Hono limitation. (`S`-generic accumulation does matter for the *RPC client*
   `hc<typeof app>()` per observation §RPC — but not for in-handler `c.req.valid()`.)
