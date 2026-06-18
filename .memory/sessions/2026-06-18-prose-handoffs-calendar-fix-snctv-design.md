---
date: 2026-06-18
tags: [streaming, playout, editorial-engine, calendar, skills, feature-design]
session_type: drain 2 prose skill handoffs → fix bounced calendar bug → design snctv-composition
related_items:
  - research-handoff-stack-library-gap-audit-1
  - research-handoff-stack-library-gap-audit-2
  - calendar-event-patch-drops-visibility
  - unified-channel-model-snctv-composition
---

# Session: prose handoffs + calendar fix + snctv-composition design

Three arcs on `platform` `main`, all committed: drained the two prose skill-doc handoffs from the
stack-library gap audit, fixed the bounced calendar visibility bug, and designed the
`snctv-composition` feature (the next unified-channel-model child).

## 1. Two prose skill-doc handoffs drained → done (commit `16d6b90`)
Picked up the gap-audit handoffs `-1` (tusd) and `-2` (srs), both `[prose]`/`documentation`.
Promoted backlog → active, authored inline, reviewed (fast lane), closed as bodyless archive stubs
(`delete-refs`, `archived_atop: 0.3.0`).

- **tusd-v2 skill**: documented the `post-finish` **failure contract** — `post-*` hooks are
  async/fire-and-forget, dispatched after the client's 204, return discarded
  (`invokeHookAsync`, tusd v2.9.2). A non-2xx is logged-and-dropped; the client never learns
  post-finish failed. Three landing points (failure-contract note by the hook table, sharpened
  post-finish guidance, a dedicated gotcha).
- **srs-v6 skill** (SKILL.md + reference.md): documented the `on_publish`/`on_unpublish`
  asymmetry — `on_publish` is fatal on callback failure, `on_unpublish` returns `void` and
  silently swallows (no retry, no signal). Scoped the over-general "non-zero disconnects the
  client" claim to gating callbacks.
- **Verification re-grounded against source** (not my own notes): both claims trace to the
  attestations (`tusd-src-2-9-2.md` lines 51/79/102; `srs-src-v6.md` hooks.cpp:200–204) and our
  code already does the right thing (`tusd-hooks.routes.ts:218`, `streaming.routes.ts:304`).
- **Substrate-before-stance caught a real overreach**: I'd generalized the srs swallow to
  `on_stop`/`on_dvr`/`on_hls`; the attestation only verifies the `on_publish`/`on_unpublish` pair,
  so I trimmed it to an explicit "not verified" note rather than asserting it. (Item `-3`, the
  `as never` cast refactor, left in backlog — not this session.)

## 2. Calendar visibility bug — fixed, held at review for fix-verify (commit `6959b7a`)
The 2026-06-13 fix-verify bounce. Original fix patched only the PATCH handler; the **POST create
path** (`creator-events.routes.ts` `.insert().values()`) omitted `visibility` entirely → a new
public show event fell to the column default `internal` on first reload (second save worked because
it's a PATCH).

- **Fix**: added `visibility: data.visibility` to the POST `.values()` block. No `?? "internal"`
  fallback — `CreateCalendarEventSchema.visibility` carries `.default("internal")`
  (`shared/calendar.ts:68`), so the value is always defined on create; mirrors the other defaulted
  fields the handler passes straight through.
- **Regression test proven to catch the bug**: stashed the fix → the create-path test fails (insert
  called without `visibility`); restored → passes. Full API suite green (1763, +1), `tsc` clean.
- **Held at `stage: review`** for the user fix-verify loopback (create a *new* public show event,
  confirm it stays public on **first** save + reload). The bounce repro was first-save-reverts.

## 3. snctv-composition designed → implementing (commit `4f4e1f1`)
Designed `unified-channel-model-snctv-composition` (feature-design), grounded against the **landed**
editorial engine (shipped in 0.4.0), not the brief's pre-engine assumptions.

**Process note worth keeping: the user stopped me mid-questions to pull up the arc.** I'd jumped to
fine-grained render-mechanism questions without first establishing where the model landed across the
editorial-engine redesigns. Reconstructing the arc (spike 2026-06-16 → unified program-source
redesign + B1 downgrade 2026-06-17 → staging walk + 0.4.0) **dissolved most of the questions** —
the engine's own §Architectural choice already names this feature and settles the hard parts.
Lesson: for a feature deep in a multi-session epic, read the completed-item/session arc **before**
asking design questions, or you re-litigate settled ground.

**Design resolutions (user):**
- **Live-takeover semantics = non-issue.** The engine's **auto-mode readiness fallback IS S/NC TV's
  fallback chain** — explicitly "the line-192 generalization, self-running" (unified redesign). No
  arm-gate dilemma; arm/take gates the *queue* tier only, orthogonal to live takeover.
- **Option A for the live input**: the `live` tier renders the shared `:1936` broadcast input **for
  the broadcast role only** (S/NC TV is the one channel that legitimately owns `:1936`; the I2
  port-collision `null`-render stays for every other role). Delivers the brief's thesis — takeover
  becomes a visible editorial tier, not plumbing. Rejected Option B (live as a render constant) —
  leaves a permanent asterisk on "every channel is just a channel."
- **Bold-refactor framing (user-authorized)**: discard the legacy broadcast I/O block. The legacy
  `/now-playing` + `on_metadata` refs are replaced by the generated `selected()`-based now-playing
  (strictly better — `on_metadata` is blind to mid-track re-selection, per the spike); the
  `notify_switch` source-switch telemetry (the live-state spine integration — load-bearing) is
  regenerated as role-conditioned events, not preserved verbatim.

**Structural finding**: the broadcast channel (`role: "broadcast"`) is **invisible to the topology
builder** today — `generateLiquidsoapConfig` filters to `role: "playout"`, so `buildPlayoutTopology`
never sees S/NC TV; it renders from a static `broadcast` field + static `.liq` tail. The feature
brings it into `channels[]` and deletes the static path.

**Decomposition** (chain on the production streaming path, each link gates the next):
`broadcast-render` (pure render learns broadcast affordances, dormant until topology activates it)
→ `topology` (broadcast channel joins the generated topology, static block deleted, docs rolled
forward — **the equivalence gate**) → {`seed-config`, `nowplaying-consumer`} (parallel). Cycle-checked.
Verification: rendered-config golden + `test-live-fallback.sh` + staged takeover/fall-back/simulcast
walk (fix-verify loopback), matching how the engine itself was verified.

## State + pending
- **Review queue**: `calendar-event-patch-drops-visibility` (held on user fix-verify).
- **snctv-composition** at `implementing`; `broadcast-render` (first chain link) is **ready**.
- **Open risk recorded in the feature body**: the `notify_switch`/`fallback(transitions=[...])`
  firing semantics carry an unresolved SPIKE NOTE (validate on the running 2.4.5 pipeline; the
  `thread.run is_ready()` poller is the documented fallback) — the staged walk must confirm
  source-switch events actually fire.
- **Not mine, left uncommitted**: `AGENTS.md` carries the pre-existing in-progress Codex-support
  change (devcontainer install + working-notes); left out of all three commits this session.

## Next
Implement the snctv chain — `broadcast-render` first
(`/agile-workflow:implement-orchestrator unified-channel-model-snctv-composition` to drive the
chain, or `/agile-workflow:implement <story>` inline per link). Then the calendar fix-verify when
the operator's at a running app.
