# Rule: Route Utilities Separation

> Shared route utilities (pagination, error schemas, file helpers) live in src/lib/, not alongside *.routes.ts files.

## Motivation

The `routes/` directory currently mixes route handlers (`*.routes.ts`) with shared utilities
(`cursor.ts`, `file-utils.ts`, `route-utils.ts`, `openapi-errors.ts`). While the naming convention
distinguishes them, physical separation makes the boundary explicit — route files define endpoints,
`lib/` provides shared infrastructure. This matches how `middleware/` and `services/` are already
separated from routes.

## Before / After

### From this codebase: utilities in routes/

**Before:**
```
apps/api/src/routes/
├── auth.routes.ts
├── booking.routes.ts
├── calendar.routes.ts
├── content.routes.ts
├── creator.routes.ts
├── cursor.ts                 # ← shared pagination utility
├── dashboard.routes.ts
├── emissions.routes.ts
├── federation.routes.ts
├── file-utils.ts             # ← shared file streaming utility
├── merch.routes.ts
├── openapi-errors.ts         # ← shared error response schemas
├── project.routes.ts
├── route-utils.ts            # ← shared URL utility
├── streaming.routes.ts
├── studio.routes.ts
├── subscription.routes.ts
├── upload.routes.ts
└── webhook.routes.ts
```

**After:**
```
apps/api/src/routes/
├── auth.routes.ts
├── booking.routes.ts
├── calendar.routes.ts
├── content.routes.ts
├── creator.routes.ts
├── dashboard.routes.ts
├── emissions.routes.ts
├── federation.routes.ts
├── merch.routes.ts
├── project.routes.ts
├── streaming.routes.ts
├── studio.routes.ts
├── subscription.routes.ts
├── upload.routes.ts
└── webhook.routes.ts

apps/api/src/lib/
├── cursor.ts                 # encodeCursor, decodeCursor, buildPaginatedResponse
├── file-utils.ts             # sanitizeFilename, inferContentType, streamFile
├── openapi-errors.ts         # ErrorResponse schema, ERROR_4xx, ERROR_502, ERROR_503
└── route-utils.ts            # getFrontendBaseUrl
```

### Synthetic example: mixed concerns in a directory

**Before:**
```
src/controllers/
├── users.controller.ts
├── products.controller.ts
├── format-response.ts        # shared response formatter
├── parse-query.ts            # shared query parser
└── validate-pagination.ts    # shared pagination validator
```

**After:**
```
src/controllers/
├── users.controller.ts
├── products.controller.ts

src/lib/
├── format-response.ts
├── parse-query.ts
└── validate-pagination.ts
```

## Exceptions

- **Route-specific helpers** — if a utility is only used by one route file, it can stay as a
  private function within that route file or as a companion file (e.g., `creator.helpers.ts`
  next to `creator.routes.ts`). Only move to `lib/` when shared across 2+ route files.
- **OpenAPI schema constants** — if `openapi-errors.ts` grows to include route-specific schemas
  beyond the shared error responses, consider splitting. The shared error constants belong in
  `lib/`; route-specific schemas stay with their route.

## Scope

- Applies to: `apps/api/src/routes/` non-route files (files without `.routes.ts` suffix)
- Target location: `apps/api/src/lib/` (create if it doesn't exist)
- Does NOT apply to: route files themselves, middleware, services
