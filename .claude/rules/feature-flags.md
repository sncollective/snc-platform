# Feature Flags

Feature flags gate **unshipped features** during active development. Once a feature ships to production, its flag is removed and routes/UI mount unconditionally.

## Active Flags

| Flag | Purpose | External dependency |
|------|---------|-----------|
| `subscription` | Stripe subscriptions + pricing page | Stripe API keys |
| `merch` | Shopify merch storefront | Shopify API keys |
| `booking` | Studio session booking | — |
| `emissions` | Carbon/energy tracking | — |
| `federation` | ActivityPub/AT Protocol interop | — |

Source of truth: `packages/shared/src/features.ts` — the `FEATURE_FLAGS` array lists all active flags.

## Golden Path

All routes and UI that are NOT behind a feature flag are production-enabled and part of the golden path for e2e testing. Routes behind active flags are excluded from the golden path until their flag is removed.

## Flag Lifecycle

1. **Add**: new feature → add flag to `FEATURE_FLAGS` in `packages/shared/src/features.ts`
2. **Gate**: wrap routes in `if (features.flag)` (API `app.ts`) and `isFeatureEnabled(flag)` (Web `beforeLoad`)
3. **Ship**: feature is production-ready → remove flag from `FEATURE_FLAGS`, remove all conditionals, mount routes unconditionally
4. **Clean up**: remove `FEATURE_*` / `VITE_FEATURE_*` env vars

## Environment

- **API**: individual `FEATURE_*` env vars (e.g., `FEATURE_SUBSCRIPTION=true`). Parsed by `booleanFlag` in `config.ts`.
- **Web**: `VITE_FEATURE_*` counterparts. Parsed by `parseFlag` in `lib/config.ts`.
- **Dev**: all flags default to ON when env var is absent (everything enabled in development).
