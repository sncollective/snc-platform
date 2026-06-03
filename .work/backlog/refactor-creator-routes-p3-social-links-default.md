---
tags: [refactor, quality, creators]
release_binding: null
created: 2026-04-20
---

# Creator Routes — Verify `socialLinks ?? []` Fallback Necessity

`apps/api/src/routes/creator.routes.ts` — `socialLinks: profile.socialLinks ?? []` — the `?? []` fallback may be unnecessary if the Drizzle schema `.$type<SocialLink[]>()` annotation is paired with `DEFAULT '[]'` and `.notNull()` on the DB column. Verify both. If both are true, `?? []` is defensive but harmless; drop it for consistency with non-defensive reads elsewhere. If either is missing, the fallback is required and the schema may have drifted from intent.

P3 — low priority. Land during next creator-routes touch.
