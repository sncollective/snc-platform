---
id: refactor-jsdoc-exported-constants
kind: feature
stage: review
tags: [refactor, documentation]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-15
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

## Implementation (2026-06-15)

Manual, JSDoc-only sweep — no ESLint, no deps, no config. Pure comment additions; black-box behavior unchanged. Authored per `.claude/rules/inline-documentation.md` (one-line imperative summaries, contract notes only where non-obvious, never restating types; Always/Recommended/Skip tiers honored).

**Edits made (6 comment blocks):**

1. `packages/shared/src/emissions.ts` — `/** */` on `EmissionsSummarySchema` (double-offset business rule: `doubleOffsetTargetCo2Kg` = 2x-gross target, `additionalOffsetCo2Kg` = top-up beyond recorded offsets, `projectedGrossCo2Kg` vs `grossCo2Kg`).
2. `packages/shared/src/emissions.ts` — `/** */` on `EmissionsFileEntrySchema` (snake_case `co2_kg` = on-disk file-format field naming, deliberately diverging from camelCase `EmissionEntrySchema`).
3. `apps/web/src/config/context-nav.ts` — one-liners on `ADMIN_NAV` and `GOVERNANCE_NAV`. **Path drift corrected:** the item said `apps/web/src/lib/context-nav.ts`; actual path is `apps/web/src/config/context-nav.ts`.
4. `packages/shared/src/simulcast.ts` — `/** */` on `SIMULCAST_PLATFORMS` (registry; `rtmpPrefix: null` => user supplies full RTMP URL).
5. `packages/shared/src/content.ts` — one-liner on `PROCESSING_STATUSES` (media-processing lifecycle uploaded → processing → ready/failed). `CONTENT_TYPES`/`VISIBILITY`/`CONTENT_STATUSES` left undocumented (self-documenting, Skip tier).
6. `packages/shared/src/streaming.ts` — one-liners on `CHANNEL_OWNERSHIPS` (permissions facet) and `CHANNEL_ROLES` (routing facet), lifted from the existing block comment (lines 6-12).

**Dropped:**

- **DETECTOR task** (install `eslint-plugin-jsdoc`, wire `jsdoc/require-jsdoc` into lint + CI). Dropped: (1) not behavior-preserving and not a code refactor — platform has *no* ESLint at all (`lint` = `tsc --noEmit`), so this would introduce an entire ESLint toolchain from scratch (infra change, not a refactor); (2) directly contradicts the governing rule — `inline-documentation.md` §Convention rationale explicitly rejects ESLint enforcement of JSDoc ("finicky, false-positive-prone, adds a dependency") and mandates agent-driven enforcement via the `scan-documentation` library; (3) the item's own caveat says do *not* add a heavy ESLint dep if a manual sweep is cleaner — it is. The "~30 export sites" framing assumed a blanket ESLint require-jsdoc sweep, which the project convention rejects.
- **Bare self-documenting enums** (`CONTENT_TYPES`, `VISIBILITY`, `CHANNEL_TYPES`-family, `BOOKING_STATUSES`, etc.) — Skip tier; forcing JSDoc would produce the redundant restatement §What NOT to Write forbids.
- **Zod-inferred `z.infer` type aliases** — Skip tier (restates type info).
- **Already-documented sites** (`RTMP_URL_REGEX`, `MAX_CREATOR_SIMULCAST_DESTINATIONS`, `MAX_TITLE_LENGTH`/`MAX_DESCRIPTION_LENGTH`, `REACTION_EMOJIS`, etc.) — no-ops.
- `chat.ts` is in the ownership set but needed no edit (constants already documented).

Net: 6 targeted comment blocks, not the ~30 the stale ESLint-detector framing implied. Re-tagging out of the detector-needs-wiring framing is reasonable on close — the prerequisite was dropped.

**Verification (all at baseline, green):**

- `bun run --filter @snc/shared test` — 675/675 passed.
- `bun run --filter @snc/web test` — 1737/1737 passed.
- `bun run --filter @snc/web typecheck` (route-gen + `tsc --noEmit`) — exit 0.
- `bun run --filter @snc/shared typecheck` (`tsc --noEmit`) — exit 0.

(Note: a bare `tsc --noEmit` in `apps/web` before route generation reports pre-existing `createFileRoute` errors from the missing generated `routeTree.gen.ts` — an artifact the `typecheck` script regenerates. None reference `context-nav`; unrelated to this change.)
