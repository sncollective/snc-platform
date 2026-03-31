# Rule: Flat Services Directory

> The services/ folder stays flat until it exceeds ~25 files. Only subdivide by domain when needed.

## Motivation

Premature folder nesting hurts discoverability more than a slightly long flat list. With 21 service
files, every file is visible at a glance. Grouping into `services/stripe/`, `services/streaming/`,
etc. adds navigation depth and makes it harder to find a service. The current flat structure
naturally communicates what services exist. Subdivide only when the directory becomes genuinely
hard to scan.

## Before / After

### From this codebase: current flat structure (correct)

**Current (keep this):**
```
apps/api/src/services/
├── channels.ts            # Streaming channel management
├── chat-rooms.ts          # Chat room lifecycle
├── chat.ts                # Chat message handling
├── content-access.ts      # Subscription-based content gating
├── creator-list.ts        # Creator listing queries
├── creator-team.ts        # Creator member permission logic
├── emissions.ts           # Carbon emissions tracking
├── external-error.ts      # Error wrapping factory for 502s
├── liquidsoap.ts          # Liquidsoap playout control
├── media-processing.ts    # Media transcode pipeline
├── playout.ts             # Playout queue management
├── processing-jobs.ts     # pg-boss job orchestration
├── revenue.ts             # Stripe revenue aggregation
├── shopify.ts             # Shopify Storefront API client
├── simulcast.ts           # RTMP forward destinations
├── slug.ts                # URL slug generation
├── srs.ts                 # SRS streaming server integration
├── stream-keys.ts         # Stream key validation
├── stream-sessions.ts     # Stream session lifecycle
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

**After (correct — stay flat at 21 files):**
```
services/
├── channels.ts
├── chat-rooms.ts
├── chat.ts
├── content-access.ts
├── ...
├── srs.ts
├── stream-keys.ts
├── stream-sessions.ts
├── stripe-client.ts
└── stripe.ts
```

### When to eventually subdivide (~25+ files)

**If services grew to 28+ files:**
```
services/
├── payments/
│   ├── stripe.ts
│   ├── stripe-client.ts
│   └── revenue.ts
├── streaming/
│   ├── srs.ts
│   ├── channels.ts
│   ├── simulcast.ts
│   ├── stream-keys.ts
│   └── stream-sessions.ts
├── content-access.ts
├── creator-team.ts
├── external-error.ts
└── slug.ts
```

## Exceptions

- **Tightly coupled service pairs** — `stripe.ts` + `stripe-client.ts` are related but still
  work fine as flat siblings. Only group if a service grows to 3+ files.
- **The ~25 threshold is a guideline, not a hard rule** — if services reach 23 but are all
  clearly named and easy to scan, stay flat. If naming overlaps make it hard to scan,
  consider grouping earlier.

## Scope

- Applies to: `apps/api/src/services/`
- Does NOT apply to: routes/ (always flat, one file per domain), middleware/ (infrastructure,
  stays flat), storage/ (already has its own directory with a clear boundary)
