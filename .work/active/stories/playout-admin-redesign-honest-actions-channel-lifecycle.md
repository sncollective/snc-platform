---
id: playout-admin-redesign-honest-actions-channel-lifecycle
kind: story
stage: implementing
tags: [playout, admin-console]
release_binding: null
depends_on: [playout-admin-redesign-responsive-structure-form-and-chrome]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: playout-admin-redesign-honest-actions
---

# Channel lifecycle honesty — create-warning + delete UI

## Scope
Unit 1 of the parent feature: in `apps/web/src/routes/admin/playout.tsx`, gate channel
creation behind a `tone="default"` ConfirmDialog naming the engine-restart consequence,
and add the missing channel-delete affordance (acts on the selected channel,
`tone="danger"` ConfirmDialog with `isPending`, wired to the existing `deleteChannel`
lib fn, reusing the restart toast/poll/reload cycle). Exact copy, placement, and
acceptance criteria in the parent feature body. Delete BOTH backlog stubs
(`bug-admin-no-channel-delete`, `channel-delete-admin-ui`) in this story's commit.

## Coordination
Writes `playout.tsx` — depends on responsive-structure's form-and-chrome story
(declared); bundle or serialize with sibling `…-queue-honesty` (same file).
