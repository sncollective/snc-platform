---
id: playout-admin-redesign-honest-actions-channel-lifecycle
kind: story
stage: review
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

## Resume note (2026-06-13)
Designed, not implemented; dep satisfied (responsive-structure archived). Before
implementing, re-read `playout.tsx`, `channels.ts`, `streaming.routes.ts`, and the
`createChannel`/`deleteChannel` libs against current HEAD — Lane 1's
`unified-channel-model-identity-lifecycle` migration is changing the channel schema
under this surface. See the parent feature's `## Resume note`.

## Implementation notes (2026-06-13)

**Re-grounding against HEAD confirmed:**
- `DELETE /channels/:channelId` — confirmed soft-deactivation (`isActive: false`) +
  `regenerateAndRestart()` + health wait at `playout-channels.routes.ts:88`. Design
  assumption holds.
- `deleteChannel` lib fn confirmed at `apps/web/src/lib/playout-channels.ts:90`.
- Channel-tab loader filters by `c.role === "playout"` from `getChannelList()` service;
  inactive channels are already excluded at the service level, so deleted channels vanish
  from tabs on reload as expected — no new code needed.
- No `ChannelType`/`CHANNEL_TYPES` references in `playout.tsx`; already uses
  `ownership`/`role` fields. No migration drift.

**Files changed:**
- `apps/web/src/routes/admin/playout.tsx` — added `ConfirmDialog` import + `deleteChannel`
  import; added `showCreateConfirm`, `showDeleteConfirm`, `isDeletingChannel` state; gated
  Create button to open `tone="default"` ConfirmDialog; added "Delete channel" button acting
  on `selectedChannelId`; added `tone="danger" isPending` ConfirmDialog for delete; wired
  delete confirm to `handleDeleteChannel` → `deleteChannel()` + existing restart toast/poll/reload
  cycle.
- `apps/web/src/routes/admin/playout.module.css` — added `.deleteChannelButton` and
  `.skipDisabledGroup` / `.skipDisabledReason` classes; fixed `.skipButton:hover` to
  `:hover:not(:disabled)` + added `:disabled` rule.
- `apps/web/tests/unit/routes/admin/playout.test.tsx` — added `createChannel` and
  `deleteChannel` to mock; added `vi.clearAllMocks()` to `beforeEach`; added tests for
  create-dialog gate, cancel-preserves-name, delete confirm + isPending wired to
  `deleteChannel`, cancel-closes-without-calling; added disabled-skip tests.

**Deviations:** None.

**Backlog stubs removed:** `bug-admin-no-channel-delete.md` and
`channel-delete-admin-ui.md` (git rm'd in this commit).

**Fix-verify loopback:** UI-only changes — create-warning dialog and channel delete
end-to-end need user confirmation in the running app at review.
