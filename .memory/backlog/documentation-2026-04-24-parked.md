---
tags: [documentation, batch-tracker]
release_binding: null
created: 2026-04-24
---

# Documentation coverage parked from 0.3.0 gate — 2026-04-24

Batch-tracker noting domains where the 0.3.0 release shipped user-facing surface but the docs gate chose to park coverage rather than block the event-day release. The [content.md tus update](../../docs/content.md) was the single gate finding and was applied inline during the gate.

The existing 8 documentation backlog items (creator-lifecycle, invite-flow, logging-conventions, manage-area-access-model, notification-system, simulcast-destination-management x2, streaming-account-connect) remain valid and continue to track their respective 0.3.0 concerns.

## Newly parked — consider scoping post-release

### Chat system guide
No `chat.md`. 0.3.0 ships chat-moderation, chat-presence, message-reactions, word filters, patron badges, and the REST moderation surface (now role-gated per the security fix). A dev reviewing the system currently has to read `chat.routes.ts`, `chat-context.tsx`, and the chat-moderation / chat-rooms services to build a mental model.

Suggested shape: `chat.md` with sections on the WebSocket protocol (`ClientEvent` / `ServerEvent` discriminated unions in `@snc/shared`), room types (platform / channel), the moderation model (ban/timeout/slow-mode + word filters), reactions, and the REST vs WS surface split.

### Design system foundation + adoption guide
No `design-system.md`. 0.3.0 completes the Ark UI foundation, token restructuring, Lucide integration, and shared component conventions. Partially referenced in `ux-decisions.md` but not a canonical guide.

Suggested shape: `design-system.md` covering token layer (`global.css` + `.module.css` boundaries), Ark UI adoption patterns (`ark-ui-v5` tech reference is the library-level doc; this would be platform-level), Lucide icon conventions, component directory structure, and the `data-scope` / `data-part` / `data-state` CSS hook model.

Note: a separate pre-existing backlog item `design-system-phase-5-testing-documentation.md` may cover part of this — dedupe when scoping.

### Live page UX + streaming-viewer surface
`streaming.md` thoroughly covers ingest / playout / Liquidsoap / Harbor infrastructure but not the viewer-side `/live` page: channel selector, theater mode, controls-visibility, mini-player, chat-panel integration, theater-exits-on-escape.

Suggested shape: add a `### Viewer-side /live page` section to `streaming.md` rather than a new doc.

### Landing page coverage
No `landing.md`. Loader-driven data flow (`/api/events/upcoming`, featured creators, recent content, Coming Up section), section ordering, feature-flag-aware composition.

Suggested shape: `landing.md` with loader → component map.

### Upload-edit UX flow
The upload pipeline mechanics are covered in `content.md` (including the new tus section). The UX flow — draft creation, attach media, replace thumbnail, clearMedia PATCH, publish — is not.

Suggested shape: extend `content.md` with a `### Content editing flow` subsection under Lifecycle, walking from draft to publish with the actual UI steps.

### Admin creators data table
`admin.md` covers user management. The new `/admin/creators` TanStack Table page with filtering, status actions, invite dialog is not covered.

Suggested shape: extend `admin.md` with an `### Admin creators table` subsection.

## Why these didn't gate-block

For the 0.3.0 event-day release, docs gate bar was: **does the absence of a doc risk misleading a deploy reviewer, or is it merely incomplete?** Only `content.md` (upload paths) actively described a mechanism that would be stale post-deploy — that got fixed inline. The others are absent-but-not-misleading: a reviewer can read the code, the absence doesn't create a wrong mental model.

## Revisit if

- Coverage debt grows past the point where the "read the code" escape hatch is fair (e.g., chat protocol + moderation rules + reactions + word filters becomes too tangled to map from code alone).
- A new contributor joins who isn't the agent-driven developer who built these systems.
- The `scan-documentation` rule library expands and starts catching these at a finer granularity than the gate does.
