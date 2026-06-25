---
id: creator-programming-e2e-provisioning
kind: story
stage: implementing
tags: [testing, streaming, playout]
parent: creator-programming-e2e
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-25
updated: 2026-06-25
---

# Spec B — lazy channel-provisioning path

Unit 2 of `creator-programming-e2e`. Independent of Spec A (golden). Exercises the
unprovisioned-creator path the seed deliberately keeps open (Jordan + Sam have no channel).

## Scope
**File**: `apps/e2e/tests/creator-programming-provisioning.spec.ts` (new) + a new auth storage-state
for an unprovisioned creator in `apps/e2e/global.setup.ts`.

**Invariant**: a creator with NO provisioned channel sees the honest "set up streaming" affordance
on Programming, and creating a stream key provisions the channel so the editorial surface appears.

Uses an UNPROVISIONED creator (Jordan `jordan-ellis` or Sam `sam-okafor`). They are not in
`global.setup.ts`'s 3 current roles, so add one creator-without-channel storage state (one extra
login in setup — keep minimal).

Test cases:
1. Unprovisioned → navigate to that creator's `/manage/programming` →
   `getByText("Set up streaming to start programming")` + `getByRole("link", { name: "Go to
   Streaming" })`, NOT the editorial surface.
2. Create a stream key via the Streaming-tab UI → return to Programming → the editorial surface now
   renders (channel lazy-provisioned by `ensureCreatorChannel`).

## Acceptance
- [ ] Both cases green; the affordance→surface transition is asserted (real provisioning, not mocked).
- [ ] New unprovisioned-creator auth fixture added to `global.setup.ts` (minimal).
- [ ] Run: `bun run --filter @snc/e2e test -- creator-programming-provisioning.spec.ts`.

## Risks / fallback
If the Streaming-tab stream-key UI is flaky or heavy to drive, fall back to provisioning via a
seed/API setup step and assert only the affordance→surface transition (case 1 + a provisioned-state
assertion), and note the reduced coverage. Don't let a flaky Streaming-tab dependency make this spec
unreliable.

## Test integrity
Park genuine product bugs (don't hide); fix drifted selectors/fixtures in-session; never game an
assertion green. A red spec documenting a real break beats a green one that lies.
