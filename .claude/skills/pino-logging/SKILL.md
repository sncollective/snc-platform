---
name: pino-logging
description: >
  Pino structured logging conventions for the SNC platform. Auto-loads when working
  with pino, rootLogger, c.var.logger, logger.info, logger.warn, logger.error,
  request-logger, logging-env, audit logging, structured logging.
user-invocable: false
updated: 2026-04-16
---

# Pino Logging Conventions

> **Library:** pino + hono-pino
> **Config:** `apps/api/src/logging/logger.ts`
> **Docs:** [docs/logging.md](../../../docs/logging.md)

## Architecture

One root logger (`rootLogger`) configured with redaction and optional pretty-printing. Request-scoped child loggers created by `hono-pino` middleware, available as `c.var.logger` in route handlers.

## Imports

```typescript
// In route handlers — logger is already on the context
// Access via c.var.logger (typed by LoggingEnv)

// In services, jobs, or startup code
import { rootLogger } from "../logging/logger.js";
```

Never import pino directly. Always use `rootLogger` or `c.var.logger`.

## Request Handlers

Use `c.var.logger` — it carries requestId, method, path, userId automatically.

```typescript
c.var.logger.info({ contentId }, "Content published");
c.var.logger.warn({ error: result.error.message, key }, "Failed to delete file");
```

The type comes from `LoggingEnv` in `middleware/logging-env.ts`. Route types should include it:

```typescript
type Env = AuthEnv & LoggingEnv;
```

## Background Jobs

Create a child logger from `rootLogger` with job context:

```typescript
const logger = rootLogger.child({
  jobId: job.id,
  contentId,
  queue: JOB_QUEUES.TRANSCODE,
});
```

Always include `jobId` and `queue`. Add the primary resource ID for the job (e.g. `contentId`, `playoutItemId`).

## Middleware Fallback

In middleware that may run before request-logger (auth, error handler), the child logger might not exist:

```typescript
const logger = c.var?.logger ?? rootLogger;
```

## Log Levels

| Level | Use for | Don't use for |
|-------|---------|---------------|
| **info** | Successful operations, state transitions, audit events | Noisy per-request details |
| **warn** | Degraded but functional, auth failures, non-fatal cleanup errors | Expected conditions |
| **error** | Broken, needs attention, unhandled exceptions | Validation failures (those are 4xx responses) |

Don't use `debug`. If you need to trace something, add a targeted `info`, get the data, remove it.

## Structured Context Rules

**Always** pass context object first, message string second:

```typescript
// Correct
logger.info({ contentId, status: "published" }, "Content published");

// Wrong — data buried in string
logger.info(`Content ${contentId} published`);
```

**Error formatting** — never pass raw Error objects:

```typescript
logger.error({ error: e instanceof Error ? e.message : String(e) }, "Upload failed");
```

Use `formatErrorMessage(e)` from `jobs/handlers/job-error.ts` in job handlers.

## Audit Events

Security-relevant actions must include an `event` field for filtering:

```typescript
logger.warn({
  event: "auth_failure",
  path: c.req.path,
  method: c.req.method,
  ip: getClientIp(c),
}, "Authentication failed — no valid session");

logger.info({
  event: "role_assigned",
  actorId: admin.id,
  targetUserId: userId,
  role,
  ip: getClientIp(c),
}, "Admin role assigned");
```

Standard event names: `auth_failure`, `authz_denial`, `role_assigned`, `role_revoked`, `user_signup`.

New audit events should follow the same pattern: `event` key, actor/target IDs, IP address.

## Redaction

The root logger redacts `authorization`, `cookie`, and `x-api-key` headers automatically. Don't log credentials, tokens, or stream keys. If a new sensitive field appears in logs, add it to the `redact.paths` array in `logger.ts`.

## Anti-Patterns

- **Don't `console.log`.** Always use the logger. Console output isn't structured and won't include request context.
- **Don't create new pino instances.** Use `rootLogger` or `rootLogger.child()`.
- **Don't log inside tight loops.** One log per operation, not per iteration.
- **Don't log request/response bodies.** They may contain user data. Log IDs and status instead.
- **Don't add `debug` level logs.** They accumulate and never get cleaned up.
