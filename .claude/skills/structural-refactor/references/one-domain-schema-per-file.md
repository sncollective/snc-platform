# Rule: One Domain Schema Per File

> Each domain gets exactly one schema file in @snc/shared — no splitting into separate types and schemas files.

## Motivation

The shared package (`packages/shared/src/`) follows a clean pattern: each domain has one file
that exports Zod schemas, inferred TypeScript types, and related constants together. This
co-location means you always know where to find a domain's types — `creator.ts` has everything
creator-related. Splitting into `creator-types.ts` + `creator-schemas.ts` + `creator-constants.ts`
fragments the domain and creates unnecessary import decisions.

## Before / After

### From this codebase: current pattern (correct)

**Current (keep this):**
```
packages/shared/src/
├── auth.ts            # ROLES, RoleSchema, UserSchema, SessionSchema + inferred types
├── booking.ts         # BOOKING_STATUSES, ServiceSchema, BookingRequestSchema + types
├── content.ts         # CONTENT_TYPES, VISIBILITY, CreateContentSchema + types
├── creator.ts         # SOCIAL_PLATFORMS, PLATFORM_CONFIG, UpdateCreatorProfileSchema + types
├── dashboard.ts       # MonthlyRevenueSchema, SubscriberSummarySchema + types
├── errors.ts          # AppError base + typed subclasses
├── merch.ts           # MerchProductSchema, MerchVariantSchema + types
├── result.ts          # Result<T, E> discriminated union
├── storage.ts         # StorageProvider interface + types
├── subscription.ts    # PLAN_TYPES, SubscriptionPlanSchema + types
└── index.ts           # barrel re-exports
```

### Synthetic example: fragmented domain files (anti-pattern)

**Before (anti-pattern):**
```
packages/shared/src/
├── creator-types.ts        # TypeScript types only
├── creator-schemas.ts      # Zod schemas only
├── creator-constants.ts    # SOCIAL_PLATFORMS, PLATFORM_CONFIG
├── creator-validators.ts   # Custom validation functions
└── creator-index.ts        # barrel re-exporting all four
```

**After (correct):**
```
packages/shared/src/
├── creator.ts              # Everything creator-related in one file
└── index.ts                # barrel
```

## Exceptions

- **Utility modules** — `errors.ts`, `result.ts`, `storage-contract.ts` are cross-cutting
  utilities, not domain schemas. They follow their own naming (not domain-based).
- **Very large domains** — if a single domain file exceeds ~300 lines, consider whether it
  actually represents two distinct sub-domains. For example, if `creator.ts` (218 lines) grew
  to 500 lines, it might mean "creator profiles" and "creator teams" are separate domains
  deserving separate files — not that the file should be split by concern (types vs schemas).
- **Feature flags and config** — `features.ts` is a cross-cutting concern, not a domain. Keep
  it separate from domain schema files.

## Scope

- Applies to: `packages/shared/src/*.ts` domain files
- Does NOT apply to: utility modules (errors, result, storage-contract), barrel (index.ts)
- New domains: create a single `{domain}.ts` file, add to barrel in `index.ts`
