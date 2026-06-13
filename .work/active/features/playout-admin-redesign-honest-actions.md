---
id: playout-admin-redesign-honest-actions
kind: feature
stage: implementing
tags: [playout, admin-console]
release_binding: null
depends_on: [shared-confirm-dialog-component]
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: playout-admin-redesign
---

# Honest actions — consequences stated before, feedback after

## Resume note (2026-06-13, Lane 3)
**Status: designed, not implemented. Held intentionally — safe to clear and resume.**
Design is complete (units, stories, decisions all below); no code was written, no
working-tree state belongs to this feature.

- **Dependencies now SATISFIED.** Both responsive-structure deps
  (`…-form-and-chrome`, `…-simulcast-table`) implemented, reviewed, fix-verified, and
  archived. The hold reason ("wait for responsive-structure review") has cleared — the
  3 child stories are unblocked and ready to implement.
- **Re-ground before implementing — `playout.tsx` and `channels.ts` moved.** Lane 1's
  `unified-channel-model-identity-lifecycle` is mid-flight migrating the channel schema
  (the `type` enum → identity/state split; `expand` + `migrate` stories landed, more in
  flight). This feature's Unit 1 (channel create/delete) reads `channels.ts`,
  `streaming.routes.ts`, the `createChannel`/`deleteChannel` libs, and the channel-tab
  loader — all in Lane 1's write path. **Before dispatching honest-actions, re-read
  those files against current HEAD**; the design's line refs and the "delete
  soft-deactivates / channel-tab loader filters isActive" assumptions may have shifted
  under the migration. The restart-warning copy stays truthful either way (verified
  against the unified epic's spike fallback), but the wiring points may have moved.
- **Same-file serialization within this feature** still holds: `…-channel-lifecycle`
  and `…-queue-honesty` both write `playout.tsx` → bundle or serialize them;
  `…-toggle-feedback` (simulcast manager) is disjoint and can run parallel.
- **Resume command:** `/agile-workflow:implement-orchestrator playout-admin-redesign-honest-actions`.

## Brief
Destructive and disruptive admin actions communicate consequence before firing and
confirm outcome after. Channel lifecycle becomes coherent and complete: channel
creation warns pre-create that it briefly restarts the playout engine (today the
warning arrives as a retroactive toast), and channel **deletion** is added end-to-end
— API + UI with confirmation carrying the same restart warning (in scope by user
decision, 2026-06-12 epic design; absorbs `bug-admin-no-channel-delete` — close it
when this lands). The simulcast destination delete swaps its bare `window.confirm`
for the shared confirm dialog (dependency: `shared-confirm-dialog-component`; closes
`bug-admin-simulcast-window-confirm` when adopted). Smaller honesty fixes ride along:
the admin simulcast page states its immediate-effect semantics ("changes to active
destinations take effect immediately on the live stream" — the admin/creator
semantics split is code-confirmed at `apps/api/src/services/simulcast.ts`), the
activate/deactivate toggle gets success feedback, the queue's misleading "est. 00:00"
on position 1 becomes "Up next", the queue picker's silent playout-only filter gets
an explanatory empty state, and the skip button renders disabled-with-reason instead
of vanishing when nothing is playing.

Does NOT cover layout (sibling `responsive-structure`) or the data layer (sibling
`live-data`) — but the disabled-skip and optimistic-update behaviors meet at the
queue UI; coordinate with `live-data` at design time.

Audit grounding: admin A1 (est sev-2, picker sev-2, skip sev-2), A3 (create warning
sev-2, no delete sev-3), A5 (semantics sev-2, window.confirm sev-2, toggle sev-1) in
`streaming-playout-ux-review-admin-audit` (archived; body at git 85151fd).

## Epic context
- Parent epic: `playout-admin-redesign`
- Position in epic: consumer of the shared confirm-dialog primitive; otherwise
  spine-independent.

## Foundation references
- `docs/streaming.md` — simulcast semantics, channel model
- `docs/admin.md` — admin surface conventions

## Design decisions
- **Scope already landed elsewhere (don't redo)**: the simulcast `window.confirm` swap
  shipped in `shared-confirm-dialog-component-simulcast-adoption` (stub
  `bug-admin-simulcast-window-confirm` deleted), and the simulcast immediate-effect
  semantics note is owned by `playout-admin-redesign-responsive-structure`'s
  simulcast-table story (decided at its design pass, since that story already rewrites
  the component). This feature covers neither.
- **Channel delete is UI-only — the API and lib layers already exist**
  (design-pass discovery): `DELETE /channels/:channelId` ships soft-deactivation
  (`isActive: false`) + `regenerateAndRestart()` + health wait
  (`playout-channels.routes.ts:70`), `deleteChannel` exists in
  `apps/web/src/lib/playout-channels.ts:90`, and the channel-tab loader filters
  `isActive: true` (`streaming.routes.ts:118`) so a deleted channel vanishes from tabs
  on reload. "End-to-end" collapses to wiring + confirm UX. Absorbs BOTH stubs:
  `bug-admin-no-channel-delete` (2026-06-12) and the older `channel-delete-admin-ui`
  (2026-04-18, same work) — delete both on landing.
- **Unified-channel-model coordination (read 2026-06-13, post-epic-design)**: the
  restart warnings stay truthful under both outcomes of that epic's switching spike —
  its declared fallback posture explicitly keeps regenerate-and-restart for channel
  CRUD. Its `identity-lifecycle` feature changes schema/lifecycle but keeps existing
  admin UI working through the migration, and this feature lands first (the unified
  chain is long). If no-restart CRUD eventually ships, the warning copy is a one-string
  update — acceptable coupling.
- **Delete placement: one "Delete channel" action on the selected channel, not an ✕
  per tab** — acts on the explicit current selection, avoids accidental taps on the
  newly-scrollable mobile tab row, and keeps the tab row clean at 3+ channels.
- **Create-warning: ConfirmDialog on Create click, keeping the inline name form** —
  `tone="default"` (disruptive, not destructive). The inline form (and its sev-4 wrap
  fix from responsive-structure) stays; only the commit step gains the consequence
  gate. Rejected: warning text permanently under the form — passive copy admins stop
  seeing; the epic mandate is consequence *before* firing.
- **Delete uses `isPending` confirm-in-place** (the known candidate named in the
  confirm-dialog design): dialog stays open with both buttons disabled while the API
  call runs, then closes into the existing engineStatus/toast/poll cycle. Create keeps
  its close-then-run shape (form already has `isCreatingChannel`).
- **Skip honesty: disabled button + visible reason text, not a tooltip** — disabled
  buttons don't reliably fire hover/focus for tooltips and the audit's intent is
  "preserve the affordance and say why"; a muted inline `"No active track"` span does
  that accessibly. Render Skip always (when a channel is selected); disable when
  `nowPlaying` is null. Whether "no active track" vs "engine not responding" can be
  distinguished is `live-data`'s scope (its freshness indicator) — this feature only
  stops the affordance from vanishing.
- **"est. 00:00" → "Up next"**: `QueueItemRow` renders "Up next" when
  `estimatedStart === 0` (cumulative-zero means first in line); `est. H:MM:SS`
  otherwise; "—" for null stays. Audit-preferred labeling, one expression change.
- **Toggle feedback via existing toaster** ("Destination activated/deactivated") —
  matches the platform's established toast feedback on playout actions; no new
  pattern.
- **Engine-restart reload timing (audit A3, dot-vs-reload race) stays with
  `live-data`** — delete reuses the existing create-flow cycle as-is; fixing the
  timing belongs to the sibling that owns honest engine state.

## Architectural choice
Pure consumption of existing primitives at the action seams: ConfirmDialog (both
tones) for the two channel lifecycle actions, copy/affordance corrections in the three
queue spots, one toast call in the simulcast manager. No new components, no API work
(discovery above), no state-model changes. The only structural choice was confirm
placement (dialog vs inline warning vs per-tab affordances) — resolved in Design
decisions.

## Implementation Units

### Unit 1: Channel lifecycle honesty (create-warning + delete)
**Files**: `apps/web/src/routes/admin/playout.tsx` (+ `playout.module.css` for the
delete-button placement; route test file if present)
**Story**: `playout-admin-redesign-honest-actions-channel-lifecycle`

**Implementation Notes**:
- Create: `Create` button click no longer calls `handleCreateChannel` directly — opens
  `<ConfirmDialog tone="default" title="Create channel?" confirmLabel="Create
  channel">` with consequence: *Creating "{name}" briefly restarts the playout engine.
  Viewers may see a short interruption.* Confirm → existing `handleCreateChannel`
  unchanged. Cancel → just closes (form + typed name preserved).
- Delete: a `Delete channel` button (ui `Button variant="danger" size` small, or the
  existing destructive button style — match the screen) rendered near the channel
  tabs/new-channel row, acting on `selectedChannelId`. Opens `<ConfirmDialog
  tone="danger" title="Delete channel?" isPending={isDeletingChannel}
  confirmLabel="Delete channel">` with consequence: *"{name}" goes offline and is
  removed from playout. The playout engine briefly restarts — viewers may see a short
  interruption.* Confirm (in-place): `deleteChannel(id)` → on success close dialog,
  `setEngineStatus("restarting")` + toast + `pollEngineHealth()` + the existing
  delayed reload (selection falls back to first remaining channel on reload); on error
  close dialog and set `actionError`.
- Both dialogs at component foot; two independent pending-state pairs.
- Delete BOTH backlog stubs in this story's commit: `bug-admin-no-channel-delete`,
  `channel-delete-admin-ui`.

**Acceptance Criteria**:
- [ ] Create requires confirming a dialog that names the engine-restart consequence.
- [ ] Cancelling create preserves the typed channel name.
- [ ] Delete channel exists, confirm-gated with `isPending`, wired to the existing
      `deleteChannel` lib fn, and reuses the restart toast/poll/reload cycle.
- [ ] Deleted channel is gone from tabs after reload (isActive filter — no new code,
      assert in test via mocked flow as practical).
- [ ] Both backlog stubs removed.

### Unit 2: Queue honesty copy
**Files**: `apps/web/src/components/admin/queue-item-row.tsx`,
`apps/web/src/components/admin/pool-item-picker.tsx`,
`apps/web/src/routes/admin/playout.tsx` (Now Playing section)
**Story**: `playout-admin-redesign-honest-actions-queue-honesty`

**Implementation Notes**:
- `QueueItemRow`: `estimateLabel` becomes `estimatedStart === 0 ? "Up next" :
  estimatedStart !== null ? \`est. ${formatSeconds(estimatedStart)}\` : "—"`.
- `PoolItemPicker` empty state (the "No playout items in pool" branch): append the
  explanation *Only playout-uploaded items can be queued. Creator content plays via
  the rotation pool.*
- Now Playing section: when a channel is selected and `queueStatus !== null` but
  `nowPlaying == null`, render the "Nothing playing" status PLUS a disabled Skip
  button with an adjacent muted span "No active track" (new small module classes);
  when `nowPlaying != null`, current enabled Skip unchanged. Loading state unchanged.

**Acceptance Criteria**:
- [ ] First queue item shows "Up next"; later items keep `est.` times; unknown stays
      "—".
- [ ] Empty queue-picker explains the playout-only filter.
- [ ] Skip is visible-disabled with reason when nothing is playing; enabled behavior
      unchanged otherwise.
- [ ] Component tests cover all three.

### Unit 3: Simulcast toggle feedback
**File**: `apps/web/src/components/simulcast/simulcast-destination-manager.tsx` (+ its
test)
**Story**: `playout-admin-redesign-honest-actions-toggle-feedback`

**Implementation Notes**:
- `handleToggleActive` success path: `toaster.success({ title: dest.isActive ?
  "Destination deactivated" : "Destination activated" })` (note: pre-toggle value
  inverts). Import `toaster` from `../ui/toast.js` per the playout route's usage.
- Tiny story — kept separate only because the file is also touched by
  responsive-structure's simulcast-table story; the `depends_on` edge serializes them.

**Acceptance Criteria**:
- [ ] Toggle success shows the correct toast for both directions; failure path
      unchanged (error banner).
- [ ] Test asserts toast fires (mock toaster per existing route-test conventions).

---

## Implementation Order
1. All three stories AFTER the responsive-structure stories land (every Unit-1/2 file
   is in that feature's write set; declared `depends_on` edges serialize):
   `…-channel-lifecycle` and `…-queue-honesty` depend on
   `playout-admin-redesign-responsive-structure-form-and-chrome` (playout.tsx);
   `…-toggle-feedback` depends on
   `playout-admin-redesign-responsive-structure-simulcast-table` (manager file).
2. Within this feature: `…-channel-lifecycle` and `…-queue-honesty` both write
   `playout.tsx` — implement as one bundle or serialize.

## Testing
Component/route unit tests per story (vitest + testing-library; ConfirmDialog
interactions per the confirm-dialog test conventions). Fix-verify loopback applies:
user confirms in the running app — create-warning dialog, channel delete end-to-end
(channel disappears), Up next label, picker note, disabled skip, toggle toasts.

## Risks
- **playout.tsx is the convergence hotspot** (this feature × responsive-structure ×
  future live-data). Mitigated by the declared cross-feature `depends_on` edges and
  bundling guidance; `live-data` designs later and reads this body.
- **Delete soft-deactivates** (`isActive: false`) — rows persist in the DB. The UI
  says "removed from playout", which is true at the editorial surface; if
  `unified-channel-model-identity-lifecycle` later changes deletion semantics, the
  dialog copy is the only coupling.
- **Reload-based tab refresh after delete** inherits the existing A3 timing wart
  (reload may race the restart indicator) — explicitly left to `live-data`.
