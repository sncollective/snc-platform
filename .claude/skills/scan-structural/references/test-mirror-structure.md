# Rule: Test Mirror Structure

> Tests live in a parallel tests/ tree mirroring src/ structure, not co-located with source files.

## Motivation

The project uses a consistent mirrored test layout across all three packages (API, web, shared).
Tests in `tests/` mirror `src/` — `tests/routes/content.routes.test.ts` tests
`src/routes/content.routes.ts`. This keeps `src/` clean for production code, makes test discovery
predictable, and aligns with Vitest community conventions. All fixture factories live in
`tests/helpers/` per package.

## Before / After

### From this codebase: current pattern (correct)

**Current (keep this):**
```
apps/api/
├── src/
│   ├── routes/
│   │   ├── content.routes.ts
│   │   └── creator.routes.ts
│   ├── services/
│   │   └── stripe.ts
│   └── middleware/
│       └── require-auth.ts
└── tests/
    ├── routes/
    │   ├── content.routes.test.ts
    │   └── creator.routes.test.ts
    ├── services/
    │   └── external-error.test.ts
    ├── middleware/
    │   ├── require-auth.test.ts
    │   └── cors.test.ts
    └── helpers/
        ├── auth-fixtures.ts
        ├── content-fixtures.ts
        └── test-constants.ts
```

### Synthetic example: co-located tests (anti-pattern for this project)

**Before (anti-pattern for this project):**
```
src/
├── routes/
│   ├── content.routes.ts
│   ├── content.routes.test.ts      # mixed with source
│   ├── creator.routes.ts
│   └── creator.routes.test.ts      # mixed with source
├── services/
│   ├── stripe.ts
│   └── stripe.test.ts              # mixed with source
└── test-helpers/                    # helpers scattered
    └── fixtures.ts
```

**After (correct for this project):**
```
src/                                 # production code only
├── routes/
│   ├── content.routes.ts
│   └── creator.routes.ts
└── services/
    └── stripe.ts

tests/                               # all tests here
├── routes/
│   ├── content.routes.test.ts
│   └── creator.routes.test.ts
├── services/
│   └── stripe.test.ts
└── helpers/
    └── fixtures.ts
```

## Exceptions

- **Integration tests** — can live in `tests/integration/` rather than mirroring the exact
  source path, since integration tests often span multiple modules.
- **Contract tests** — `storage-contract.ts` lives in `packages/shared/src/` because it's
  exported as a testing utility (via `@snc/shared/testing`), not because it's a test itself.
  This is a deliberate design choice, not a violation.
- **Test data fixtures** — fixture files (`*-fixtures.ts`) live in `tests/helpers/` per package.
  Each package maintains its own fixtures; do not share fixtures across packages.

## Scope

- Applies to: `apps/api/tests/`, `apps/web/tests/`, `packages/shared/tests/`
- Naming: `{source-filename}.test.ts` — mirrors the source filename exactly
- Fixture location: `tests/helpers/{domain}-fixtures.ts`
- Does NOT apply to: `storage-contract.ts` (exported utility, not a test file)
