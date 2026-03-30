# Logging

The API uses [Pino](https://getpino.io/) for structured JSON logging. Every log line is machine-parseable. In development, `pino-pretty` makes them human-readable too.

## Setup

One root logger, configured in `logging/logger.ts`. Log level comes from the `LOG_LEVEL` env var. Sensitive headers (`authorization`, `cookie`, `x-api-key`) are automatically redacted — they show up as `[REDACTED]` in output.

## Request logging

Every HTTP request gets its own child logger via `hono-pino` middleware. It's available in route handlers as `c.var.logger`. Each request logger automatically carries:

- `requestId` — from the `x-request-id` header, or a generated UUID
- `method` and `path` — what was called
- `statusCode` and `responseTime` — how it went
- `userId` — added on response if the request was authenticated

You don't need to add any of this manually. Just use `c.var.logger` and the context follows.

```typescript
c.var.logger.info({ contentId }, "Content published");
c.var.logger.warn({ error: result.error.message, key }, "Failed to delete file");
```

## Background jobs

Jobs don't have request context, so they create a child logger from the root with job-specific fields:

```typescript
const logger = rootLogger.child({
  jobId: job.id,
  contentId,
  queue: JOB_QUEUES.TRANSCODE,
});

logger.info({ videoCodec: probe.videoCodec }, "Codec requires transcoding");
logger.error({ error: formatErrorMessage(e) }, "Transcode failed");
```

Every job log line includes the job ID and queue name. You can trace a single job's lifecycle by filtering on `jobId`.

## Log levels

Three levels in practice:

| Level | When | Examples |
|-------|------|---------|
| **info** | Successful operations, state changes | "Server started", "Transcode complete", "New user registered" |
| **warn** | Something degraded but didn't break | "Failed to delete old file", "Authentication failed", "Liquidsoap unreachable" |
| **error** | Something broke and needs attention | "Unhandled error", "Playout ingest failed", "FFmpeg error" |

We don't use `debug` in production code. If you need to trace something, add a targeted `info` log, get the data, and remove it.

## Audit events

Security-relevant actions get structured audit fields. These all include an `event` key for filtering:

```typescript
// Auth failure
logger.warn({
  event: "auth_failure",
  path: c.req.path,
  method: c.req.method,
  ip: getClientIp(c),
}, "Authentication failed — no valid session");

// Role change
logger.info({
  event: "role_assigned",
  actorId: admin.id,
  targetUserId: userId,
  role,
  ip: getClientIp(c),
}, "Admin role assigned");
```

Current audit events: `auth_failure`, `authz_denial`, `role_assigned`, `role_revoked`, `user_signup`.

## Structured context

Always pass context as the first argument (object), message as the second (string). Pino parses the object into structured fields.

```typescript
// Good — structured and filterable
logger.info({ contentId, status: "published" }, "Content published");

// Bad — data buried in a string
logger.info(`Content ${contentId} published with status published`);
```

**Error formatting.** Never pass raw Error objects — Pino won't serialize them usefully. Extract the message:

```typescript
logger.error({ error: e instanceof Error ? e.message : String(e) }, "Upload failed");
```

There's a `formatErrorMessage()` helper in `jobs/handlers/job-error.ts` for this.

## Middleware fallback

In middleware that runs before the request logger (auth, error handler), the child logger might not exist yet. Use the fallback pattern:

```typescript
const logger = c.var?.logger ?? rootLogger;
```

This keeps logging working even at the edges of the request lifecycle.
