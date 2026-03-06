# Pattern: Zod Env Config

`ENV_SCHEMA` (Zod object) validates environment variables; `parseConfig(env)` is exported for test injection; module-level `config` singleton crashes at import if env is invalid.

## Rationale

Zod schemas serve double duty: runtime validation of env vars and TypeScript type generation via `z.infer`. Exporting `parseConfig()` separately from the `config` singleton lets tests inject custom env objects without global mutation or environment variable patching. The module-level constant ensures the app fails fast at startup rather than at first use.

## Examples

### Example 1: Schema, type, parser, and singleton in config.ts
**File**: `apps/api/src/config.ts:5`
```typescript
export const ENV_SCHEMA = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:3080"),
});

export type Config = z.infer<typeof ENV_SCHEMA>;

export const parseConfig = (
  env: Record<string, string | undefined>,
): Config => {
  return ENV_SCHEMA.parse(env);
};

/** Crashes at import time if required env vars are missing. */
export const config: Config = parseConfig(process.env);
```

### Example 2: Consumers import `config` directly
**File**: `apps/api/src/middleware/cors.ts:3` and `apps/api/src/db/connection.ts:4`
```typescript
// cors.ts
import { config } from "../config.js";
export const corsMiddleware = cors({ origin: parseOrigins(config.CORS_ORIGIN), ... });

// db/connection.ts
import { config } from "../config.js";
export const sql = postgres(config.DATABASE_URL);
```

### Example 3: Tests inject custom env via parseConfig()
**File**: `apps/api/tests/config.test.ts:8`
```typescript
it("returns a valid Config when all required vars are set", () => {
  const result = parseConfig({ DATABASE_URL: TEST_DATABASE_URL });
  expect(result).toStrictEqual({
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: 3000,
    CORS_ORIGIN: "http://localhost:3080",
  });
});

it("coerces PORT string to number", () => {
  const result = parseConfig({ DATABASE_URL: TEST_DATABASE_URL, PORT: "4000" });
  expect(result.PORT).toBe(4000);
});
```

## When to Use

- Any new configuration group (e.g., storage provider settings, feature flags)
- Add fields to `ENV_SCHEMA` for new required/optional env vars
- Use `z.coerce` for numeric/boolean env vars; use `.default()` for optional fields

## When NOT to Use

- Runtime configuration that changes per-request (use context/middleware instead)
- Secrets that should not be logged (still use this pattern, just avoid logging `config`)

## Common Violations

- Reading `process.env.VAR` directly in middleware/routes instead of `config.VAR` — bypasses validation and loses type safety
- Not exporting `parseConfig()` — prevents test injection without env var mutation
- Using `z.string().optional()` for fields that have defaults — use `.default()` instead so `Config` has non-optional properties
