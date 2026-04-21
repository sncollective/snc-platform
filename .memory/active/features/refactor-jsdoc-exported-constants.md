---
id: feature-refactor-jsdoc-exported-constants
kind: feature
stage: implementing
tags: [refactor, documentation]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Exported `as const` array constants and Zod schemas across the shared package and web app lack `/** */` JSDoc. Without doc comments, tools (IDEs, doc generators, ESLint-jsdoc rule) have no machine-readable description for these values — future contributors and agents reading call sites get no inline hint about what a constant represents or why its values are what they are. This is especially costly for domain-specific schemas like `EmissionsFileEntrySchema` (snake_case field rationale) and `EmissionsSummarySchema` (double-offset business rule), where the value shape alone cannot communicate the intent.

## Pattern

Exported `as const` array constants and named Zod schemas with no preceding `/** */` block. Applies to `packages/shared/` and web API utilities. After the detector is wired, sweeping is a mechanical one-line-doc-per-export pass.

## Detector

Install `eslint-plugin-jsdoc` and configure the `recommended-typescript-error` preset in the platform ESLint config. Key rules to enable: `jsdoc/require-jsdoc` scoped to exported variables and functions. Integrate `eslint --rule` check into the existing `lint` script and the CI lint step so the rule is enforced continuously after the sweep. The inline-documentation-conventions research (in platform research memory) provides tier guidance for distinguishing required vs. recommended coverage.

## Representative sites

- `packages/shared/src/content.ts` — `CONTENT_TYPES`, `VISIBILITY`, `CONTENT_STATUSES`, `PROCESSING_STATUSES`, `PROCESSING_JOB_TYPES`, `PROCESSING_JOB_STATUSES` (6 constants, no JSDoc)
- `packages/shared/src/emissions.ts` — 7 schemas + 7 types; `EmissionsFileEntrySchema` snake_case field naming and `EmissionsSummarySchema` double-offset business rule are particularly worth documenting
- `packages/shared/src/streaming.ts` — `CHANNEL_TYPES`, `StreamStatusSchema`, `StreamKeyCreatedResponseSchema`, `ActiveStreamSchema`
- `packages/shared/src/simulcast.ts` — `SIMULCAST_PLATFORMS`, `SIMULCAST_PLATFORM_KEYS`
- `apps/web/src/lib/context-nav.ts:23,38` — `ADMIN_NAV`, `GOVERNANCE_NAV`

## Notes

Full site list: `packages/shared/src/chat.ts` (`CHAT_ROOM_TYPES`), `booking.ts` (`BOOKING_STATUSES`), `playout.ts` (`RENDITIONS`, `PLAYOUT_PROCESSING_STATUSES`, `RENDITION_PROFILES`, `VIDEO_RENDITIONS`), `calendar.ts` (`DEFAULT_EVENT_TYPES`), `uploads.ts` (`SOURCE_TYPES`, `UPLOAD_PURPOSES`), `subscription.ts` (`PLAN_TYPES`, `PLAN_INTERVALS`, `SUBSCRIPTION_STATUSES`), `studio.ts` (`STUDIO_SERVICES`). Approximately 14 constants across shared plus the 4 from `streaming.ts`, `simulcast.ts`, and `playout.ts` extras, plus the 2 web nav exports — roughly 30 export sites total once the detector sweeps them all. ESLint setup is the prerequisite; the doc-addition pass follows mechanically once the rule reports.
