---
tags: [security, streaming]
release_binding: null
created: 2026-04-20
---

# SRS Callback Secret: Enforce Required in Production at Startup

Followup to the 2026-03-31 SRS callback authentication implementation. The middleware in the API currently logs a warning when `SRS_CALLBACK_SECRET` is unset and continues to accept callbacks — a dev-friendly default that allows local development without configuring the secret.

In production this default is dangerous: an unset secret silently disables callback authentication, allowing unauthenticated callers to trigger on_publish / on_unpublish events.

Fix: add `SRS_CALLBACK_SECRET` to the API config Zod schema as required when `NODE_ENV !== 'development'`. The app should throw at startup (fail-fast) if the variable is missing in any non-dev environment, rather than logging a warning and continuing.

The dev variant (optional + warning) remains appropriate. The production variant (required + crash on missing) is the gap.

Affected: API config schema (Zod), likely `platform/apps/api/src/config.ts` or equivalent config entry point.
