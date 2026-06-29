---
id: gate-patterns-stale-examples
kind: story
stage: drafting
tags: [documentation, refactor]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: patterns
created: 2026-06-29
updated: 2026-06-29
---

# 9 documented patterns have stale file:line examples (refresh to match current code)

## Severity
Medium (skill-stale — the patterns are still valid; only their example paths drifted)

## Source
gate-patterns scan over the 0.4.0 bundle. The pattern *shapes* are still correct; the *example citations* (file:line) point at code that has since moved or been restructured.

## Stale patterns (refresh each pattern file's examples)

| Pattern file | Stale citation | Current location |
|---|---|---|
| `content-access-gate.md` | cites `apps/api/src/routes/content.routes.ts:174,376` (feed `rawItems.map`/`hasContentAccess`) | detail gating now around `content.routes.ts:165,218` |
| `human-readable-url-slug.md` | cites backend resolver at `apps/api/src/routes/creator.routes.ts:69` | resolver moved to `apps/api/src/lib/creator-helpers.ts:15` |
| `react-context-reducer-provider.md` | cites root-layout `AudioPlayerProvider`/`MiniPlayer` | current `apps/web/src/routes/__root.tsx` uses `GlobalPlayerProvider`, `AppShell`, `GlobalPlayer` |
| `route-private-helpers.md` | cites private helpers/constants inside `content.routes.ts` | now imports `resolveContentUrls`/`requireContentOwnership` from `../lib/content-helpers.js`, errors from `../lib/openapi-errors.js` |
| `row-to-response-transformer.md` | cites content transformer at `content.routes.ts:61` | now at `apps/api/src/lib/content-helpers.ts:53` (+slug, responsive thumbnail, cache-bust, processing metadata) |
| `storage-provider-singleton.md` | content upload usage example in `content.routes.ts` | upload handling moved out of that route file |
| `tanstack-file-route.md` | root route example | stale vs current `__root.tsx` (wraps providers, delegates layout to `AppShell`) |
| `thin-handlers-fat-services.md` | content access route snippet at `content.routes.ts:302` | current handler path uses `applyContentGate` earlier in the file |
| `upload-replace-workflow.md` | cites upload handlers in `creator.routes.ts` + `content.routes.ts` | handlers split into media-specific route modules |

## Remediation direction
For each pattern file, refresh the example citations to point at the current code locations (verify each by grepping the current source). The pattern *descriptions* need no change — only the `## Instances` / example `file:line` references. Several of these moves reflect the same `lib/*-helpers.ts` extraction the `refactor-route-file-size-splits` work introduced, so the citations cluster around the content/creator route → lib/helper migration.

## Note
The 7 NEW patterns discovered in this same gate (`structural-edit-regenerate-restart`, `fire-and-forget-event-publish`, `exactly-one-source-contract`, `e2e-test-control-state-bracket`, `bounded-expect-poll-probe`, `controlled-confirm-dialog`, `responsive-table-dual-render`) have been written to `.claude/skills/platform-patterns/` and added to the SKILL.md + rules digest indexes — that work is done, not part of this stale-refresh item.
