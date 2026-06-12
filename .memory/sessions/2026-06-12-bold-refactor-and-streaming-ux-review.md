---
date: 2026-06-12
tags: [refactor, streaming, playout, design-system, accessibility, workflow]
session_type: bold-refactor + ux-audit
related_items:
  - bold-channel-topology
  - bold-lifecycle-transitions
  - bold-event-spine
  - bold-upload-purpose-registry
  - streaming-playout-ux-review
  - live-experience-redesign
  - playout-admin-redesign
  - srs-callback-rate-limit-deadlock
related_decisions: []
---

# Session: bold-refactor scan (4 epics) + streaming/playout UX review through audits to go/no-go

One session, two arcs that ended up feeding each other: a full-codebase `/bold-refactor`
sweep that scoped four reconception epics, then a UX review of the streaming/playout
surfaces that ran scope → feature-design → orchestrated audits → interactive go/no-go,
producing two redesign epics whose evidence directly validates the bold-refactor
event-spine thesis.

**⚠ Everything is uncommitted.** This container has no git metadata (`.git` is a
submodule pointer to an unmounted `/workspaces/.git/modules/platform`), so every
substrate write from this session — 6 epics, 12+ features, 11 stories, ~20 backlog
items, session note — awaits `git add .work/ .memory/ && git commit` from a full
checkout. That's the first thing a follow-up session at a real station should do.

## Arc 1 — bold-refactor sweep

Three parallel Explore agents (architecture / hotspots / hidden assumptions) over the
~50k-LOC monorepo. Load-bearing move: checked `.research/analysis/positions/` before
provoking — the two biggest raw findings (route-ceremony factory ~2.8k lines,
shared-schema triplication) are **held positions with untripped revisit conditions**
(`route-handler-ceremony.md` rejects the factory outright as foreclosing Hono RPC;
`api-source-of-truth.md` defers codegen until a second consumer or 3 drift bugs/quarter).
Deliberately proposed nothing there. Four epics survived the user checkpoint, all
accepted:

- `bold-channel-topology` (Declarative) — playout topology as typed data; `.liq` as pure
  render; drift detect + manual reconcile (user narrowed from auto-reconcile).
- `bold-lifecycle-transitions` (Domain Crystallization) — three scattered status state
  machines (playout queue, content processing, stream session) get owning transition
  modules; explicitly no generic framework.
- `bold-event-spine` (Inversion) — SSE spine replacing the 3s/10s polling; children
  untagged (not behavior-preserving — tag rubric matters).
- `bold-upload-purpose-registry` (Unification) — four parallel purpose Records → one
  type-enforced registry.

Cross-cutting deps declared on three in-flight refactor stories (stream-names-dedup,
streaming-lifecycle-extraction, use-polling-hook). Sequencing call made with the user:
UX review runs BEFORE/alongside; spine server-side before redesigns; client-conversion
feature deferred into redesigns ("screens born subscribed").

## Arc 2 — streaming/playout UX review

Scoped audit-first (feature `streaming-playout-ux-review`, all three audiences, design
system in scope), designed with 5 stories (protocol → 3 parallel surface audits →
interactive synthesis), then orchestrated.

**Protocol story = mostly env repair.** The container's dev env was broken on arrival:
DB had ZERO tables (502s masked as `SRS_ERROR` — the catch-all `wrapSrsError` swallowed
a Drizzle failure), Garage uninitialized, Playwright browsers absent. After
migrate+seed, the playout chain stayed down — diagnosed the **publish-retry ×
rate-limiter deadlock**: failing on_publish → SRS rejects → Liquidsoap retries ~3
streams/s → permanently saturates the 30/60s IP limiter; AND after the cause clears,
SRS holds zombie publisher sessions (`acquire_publish: Resource temporarily
unavailable`) that bounce fresh connects. Recovery sequence (now in the feature's
protocol section): stop Liquidsoap → restart SRS → wait >60s → start Liquidsoap.
Parked as `srs-callback-rate-limit-deadlock` — production-grade, and live evidence for
bold-channel-topology's drift-detection feature. Also noted stale `.liq` carrying a
dead third channel from the pre-wipe DB.

**Audits** ran as 2 waves (viewer+creator parallel; admin solo because A3 restarts
Liquidsoap). Findings written into story bodies, not the feature (write-race deviation,
recorded). 65 findings: 1 sev-4 (admin create-channel submit button entirely off-screen
on mobile), 18 sev-3. 13 a11y items + 3 bugs filed during audit (notably
`bug-connect-button-missing-style` — `.secondaryButton` missing from button.module.css,
buttons render unstyled). Defining cross-surface theme: **system status is invisible
everywhere** (LIVE badge literally never renders — `type === "live"` never matches
`"broadcast"`; takeover invisible; silent stale polls) — one-to-one with the
event-spine thesis, now evidence-backed.

**Go/no-go (user decisions):** Viewer GO → `live-experience-redesign`; Creator NO-GO →
5 fix stories (copy button, revoke confirm, mobile form wrap, RTMP URL validation,
semantics note); Admin GO → `playout-admin-redesign`. Both redesign epics carry the
born-subscribed mandate; `bold-event-spine-client-subscriptions` marked absorbed.
Design-system backlog: `responsive-table-card-pattern`, `shared-confirm-dialog-component`.
Event-needs list mirrored into the spine epic body.

## Residuals / next session

1. **Commit everything** (see warning above).
2. Dev DB carries "Audit Test Channel" + "Audit Test Film" (no channel-delete UI —
   `bug-admin-no-channel-delete`).
3. Synthesis comparable-product scan was kept light (rubric nuggets carried the
   evidence); honest note in the synthesis story.
4. Ready next moves: `/agile-workflow:review streaming-playout-ux-review` (feature-level
   deep review), epic-design on the two redesign epics, orchestrator over the 5 creator
   fix stories, refactor-design on `bold-channel-topology-model-render` (riskiest-first
   feasibility test for the largest bold epic).
