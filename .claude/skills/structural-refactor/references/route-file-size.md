# Rule: Route File Size

> Route files should target ≤400 lines; files over 600 lines must be actively split.

## Motivation

Hono route files are denser than Express — they combine path definitions, Zod validation schemas,
OpenAPI metadata, and handler logic inline. A 400-line Hono file carries equivalent complexity to
a 600-line Express controller. Beyond 400 lines, handlers become hard to navigate and review.
Beyond 600, they reliably contain extractable business logic that belongs in services.

## Before / After

### From this codebase: creator.routes.ts (1,077 lines)

**Before:**
```
apps/api/src/routes/
├── creator.routes.ts          # 1,077 lines — handlers + slug generation + permission
│                              #   checks + DB queries + file streaming + team logic
├── content.routes.ts          # 1,039 lines — handlers + access checks + file utils
├── calendar.routes.ts         #   739 lines — handlers + recurrence logic + queries
├── booking.routes.ts          #   511 lines
├── upload.routes.ts           #   481 lines
└── ...                        #   (remaining files under 400 lines — fine)
```

**After:**
```
apps/api/src/routes/
├── creator.routes.ts          # ~250 lines — thin handlers: validate → delegate → respond
├── content.routes.ts          # ~300 lines
├── calendar.routes.ts         # ~250 lines
├── booking.routes.ts          # ~300 lines
├── upload.routes.ts           # ~250 lines
└── ...

apps/api/src/services/
├── creator.ts                 # NEW — slug generation, permission checks, profile CRUD
├── content.ts                 # NEW — access checks, content CRUD, feed queries
├── calendar.ts                # NEW — recurrence logic, event CRUD
└── ...
```

### Synthetic example: monolithic route file

**Before:**
```typescript
// users.routes.ts — 800 lines
app.post('/users', validator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json');
  // 40 lines of password hashing, uniqueness check, role assignment,
  // welcome email, audit log, response formatting...
});
```

**After:**
```typescript
// users.routes.ts — 80 lines
app.post('/users', validator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json');
  const result = await createUser(data);
  if (!result.ok) return c.json({ error: result.error }, result.error.statusCode);
  return c.json(result.value, 201);
});

// services/users.ts — business logic, no Hono imports
export async function createUser(data: CreateUser): Promise<Result<User, AppError>> { ... }
```

## Exceptions

- **Generated files** (`routeTree.gen.ts`) — no size limit, these are auto-generated
- **Route files with many simple CRUD endpoints** — a file with 15 two-line handlers may exceed
  400 lines while remaining perfectly readable. The trigger is complexity, not just length.
- **Files at 400-600 lines** — candidates for extraction but not urgent. Prioritize by churn
  rate (frequently modified files benefit most from splitting).

## Scope

- Applies to: `apps/api/src/routes/*.routes.ts`
- Does NOT apply to: test files, schema files, generated files, shared package
