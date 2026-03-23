# Rule: Flat Services Directory

> The services/ folder stays flat until it exceeds ~15 files. Only subdivide by domain when needed.

## Motivation

Premature folder nesting hurts discoverability more than a slightly long flat list. With 9 service
files, every file is visible at a glance. Grouping into `services/stripe/`, `services/content/`,
etc. adds navigation depth and makes it harder to find a service. The current flat structure
naturally communicates what services exist. Subdivide only when the directory becomes genuinely
hard to scan.

## Before / After

### From this codebase: current flat structure (correct)

**Current (keep this):**
```
apps/api/src/services/
├── content-access.ts      # Subscription-based content gating
├── creator-team.ts        # Creator member permission logic
├── external-error.ts      # Error wrapping factory for 502s
├── owncast.ts             # Owncast streaming integration
├── revenue.ts             # Stripe revenue aggregation
├── shopify.ts             # Shopify Storefront API client
├── slug.ts                # URL slug generation
├── stripe-client.ts       # Stripe SDK instance
└── stripe.ts              # Stripe service functions
```

### Synthetic example: premature nesting (anti-pattern)

**Before (anti-pattern):**
```
services/
├── stripe/
│   ├── client.ts
│   └── service.ts
├── shopify/
│   └── service.ts
├── content/
│   └── access.ts
├── creator/
│   └── team.ts
└── shared/
    ├── external-error.ts
    └── slug.ts
```

**After (correct — stay flat at 9 files):**
```
services/
├── content-access.ts
├── creator-team.ts
├── external-error.ts
├── owncast.ts
├── revenue.ts
├── shopify.ts
├── slug.ts
├── stripe-client.ts
└── stripe.ts
```

### When to eventually subdivide (~15+ files)

**If services grew to 18 files:**
```
services/
├── payments/
│   ├── stripe.ts
│   ├── stripe-client.ts
│   └── revenue.ts
├── integrations/
│   ├── shopify.ts
│   └── owncast.ts
├── content-access.ts
├── creator-team.ts
├── external-error.ts
└── slug.ts
```

## Exceptions

- **Tightly coupled service pairs** — `stripe.ts` + `stripe-client.ts` are related but still
  work fine as flat siblings. Only group if a service grows to 3+ files.
- **The ~15 threshold is a guideline, not a hard rule** — if services reach 13 but are all
  clearly named and easy to scan, stay flat. If 12 files have confusing naming overlaps,
  consider grouping earlier.

## Scope

- Applies to: `apps/api/src/services/`
- Does NOT apply to: routes/ (always flat, one file per domain), middleware/ (infrastructure,
  stays flat), storage/ (already has its own directory with a clear boundary)
