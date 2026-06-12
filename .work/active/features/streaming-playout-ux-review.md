---
id: streaming-playout-ux-review
kind: feature
stage: drafting
tags: [streaming, playout, design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Streaming + playout UX/UI review

## Brief
A structured UX/UI audit of the streaming and playout surfaces across all three
audiences: viewer-facing (`apps/web/src/routes/live.tsx`, the global player),
creator-facing (`creators/$creatorId/manage/streaming.tsx`, simulcast destination
manager, stream key management), and admin (`apps/web/src/routes/admin/playout.tsx`).
Output: findings per surface plus a go/no-go redesign recommendation per surface —
redesign epics spawn from this review only where it says rework is warranted, per the
"agent surfaces evidence, user decides" framework in `docs/ux-decisions.md`.

The review may propose changes to the design system itself (tokens, shared components,
the context-shell pattern), not just recompositions within it — design-system findings
are first-class output, tagged `[design-system]` when filed.

## Coordination with bold-refactor epics (2026-06-12)
This review runs before/alongside the bold-refactor epics scoped the same day. Its
conclusions feed the design of `bold-event-spine` (what events the screens actually
need, which screens survive). If redesigns proceed, the redesigned screens should be
born subscribed to the SSE spine rather than converted from polling first —
`bold-event-spine-client-subscriptions` gets absorbed into the redesign work or shrinks
to surfaces the redesign doesn't touch. The backend epics (`bold-channel-topology`,
`bold-lifecycle-transitions`, `bold-upload-purpose-registry`) are independent of this
work; named lifecycle states and drift surfacing from those epics are good inputs for
what the admin UI can honestly display.

## Strategic decisions
- **Commitment shape**: audit first — review produces findings + per-surface go/no-go;
  redesign epics spawn only where warranted. Avoids redesigning screens the audit would
  pass.
- **Surface scope**: all three audiences equally (viewer, creator, admin) — one coherent
  sweep, no priority ordering.
- **Design-system scope**: in scope — the review may propose token/component/shell
  changes directly, accepting the wider blast radius.
