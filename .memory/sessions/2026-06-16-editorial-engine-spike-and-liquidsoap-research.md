---
date: 2026-06-16
tags: [streaming, playout, liquidsoap, spike, research, ard, editorial-engine]
session_type: editorial-engine spike → LS version/capability research campaign → ARD method canonization
related_items:
  - unified-channel-model-editorial-engine
  - liquidsoap-version-capability-audit
  - feature-ard-vendored-source-research-mode
---

# Session: editorial-engine spike → Liquidsoap research campaign → vendored-source research mode

Picked up the editorial-engine arc at its mandated opening spike (no-restart switching), which
turned into a much larger thread: a full research campaign on Liquidsoap versions/capabilities, an
upgrade recommendation + handoff, and a framework-level research-method finding canonized into ARD.

## 1. The no-restart switching spike — SETTLED

The `unified-channel-model` epic named no-restart live switching as its central technical risk and
required the editorial-engine design to open with a spike. Ran it against the live Liquidsoap 2.4.2
container (throwaway off the prod image; **prod never touched, 0 restarts**), then extended into a
source-dive against the tag-pinned 2.4.2 tree.

**Result: live editorial switching works.** ref()-backed `switch()` predicates re-evaluate every
frame at `track_sensitive=false`; `source.dynamic` swaps tier content live; runtime clock
attach/detach supports channel CRUD with one constraint (last output detached → clock thread exits
→ keep a sentinel output). The epic's "fallback if the spike disappoints" did NOT activate.

Key gotcha that cost spike time: observe selected source via `switch.selected()`, NEVER
`on_metadata`/`on_track` (blind to mid-track re-selection — read as "stuck" while audio had
switched). Recorded in `.research/analysis/positions/editorial-engine-switching-mechanism.md` (the
mechanism, the CRUD boundary, control-plane surface, all with file:line evidence). The
`liquidsoap-v2` skill gained a Dynamic Topology section it was missing.

## 2. Liquidsoap version/capability research campaign — full rigor, all gates passed

The source-dive surfaced that we run 2.4.2 while upstream is at 2.4.5 (2.5.0 unreleased), with
fixes on paths the rearchitecture will use. Registered a `[research]` item
(`liquidsoap-version-capability-audit`, dials: mixed scope / full rigor) and ran it through the
research-orchestrator: 4 parallel specialists, then lint → adversarial-read (APPROVED) → isolated
evaluate (APPROVED) → spot-check. The lint floor caught a real disciplinary error (I'd cited
specialist-brief slugs as `[handle]{N}` targets instead of source-direct attestations — fixed);
the adversarial pass caught a mislabeled issue number (#5237) — both corrected.

**Findings:**
- **Upgrade 2.4.2 → 2.4.5 now** (operator-decided), revert if breaking. The 2.4.3–2.4.5 fixes
  (clock-detach-while-running #5051, sub-clock CPU growth #5032/#5103, skip-from-harbor crashing
  crossfade #5194, harbor.remove_http_handler) are **latent** on our current simple render graph
  but activate exactly when the editorial design reaches for crossfade / runtime detach / runtime
  handler-removal / `source.dynamic`. So the upgrade decision is coupled to editorial feature scope.
- **2.5.0 adds no new switching/CRUD power** — don't wait for it. Its subtitle content-type is a
  carriage seam (no ASR); the captions/subtitles backlog items are player-side (the seed
  hypothesis was corrected by the discovery surface — the `mixed` dial earning its keep).
- **Backlog partitions cleanly** (LS-side editorial cluster reshaped by the spike; SRS-side;
  player-side; ffmpeg-sidecar). An LS bump moves only the editorial cluster.
- **VAAPI/ABR: encode outside SRS** (SRS transcode is software-libx264-only, issue #3267 Won't-fix).

Output: `.research/analysis/campaigns/liquidsoap-version-capability-audit/` (parent synthesis +
upgrade rec, 4 specialist briefs, acquisitions, verification-checklist, campaign-evaluation) + 13
source-direct attestations. Item closed to `done` (`research_completion: close-to-done`).

## 3. Research handoff — 3 items filed

`/agentic-research:research-handoff` emitted (operator-confirmed):
- `research-handoff-liquidsoap-version-capability-audit-1` (active/stories) — **Upgrade Liquidsoap
  2.4.2 → 2.4.5** (Dockerfile pin + pre-upgrade greps + staging verify + revert plan). Ready to
  design/implement.
- `-2` (backlog) — spike `h264_vaapi` in Liquidsoap's `%ffmpeg` encoder (VAAPI-upstream vs sidecar).
- `-3` (backlog) — SRS max streams/vhosts for dynamic channels.

## 4. Vendored-source research mode — canonized into ARD (at root)

The debrief surfaced a framework-level finding: for an open-source dependency, the highest-rigor
research corpus is the **source tree cloned at the version we run**, not the web docs. ARD already
expresses the tier difference (source-direct vs search-summary confidence) but doesn't yet name
pinned-source-clone as a first-class acquisition pattern. The audit gave a clean in-engagement
contrast (LS source-diff = source-direct; SRS = web-search-summary).

Because root authors ARD + the research-orchestrator, this canonizes **upstream** (root scope, not
platform): the position `.research/analysis/positions/vendored-source-research-mode.md` (root) is
the source spec; `feature-ard-vendored-source-research-mode` was added as a sixth child of
`epic-ard-catalog-and-tooling-growth` (reopened review→implementing) to ride the v0.6.0 cut. Carries
the two-pronged applicability gate (source-available AND behavior/version-question) — the
game-research tangent (mixed-source, mixed-goal) is the standing boundary that keeps it from
over-generalizing. Immediate SNC payoff: richer research-backed skills for the OSS-heavy media stack
(SRS, imgproxy, tusd, pg-boss, Garage).

## 5. Vendored-source applied + dependency hygiene (end of session)

Applied the new mode to platform's deps and surfaced an adjacent hygiene gap.

- **5 vendored-source `[research]` backlog items** for the Tier-1 OSS infra services where the
  applicability gate genuinely pays: `research-srs-vendored-source`, `research-garage-vendored-source`,
  `research-tusd-vendored-source`, `research-imgproxy-vendored-source`, `research-pg-boss-vendored-source`.
  Each = acquire (clone @ pinned version) + orient (source-ground the tech-reference skill), NOT a
  full campaign. **Held the gate:** deliberately did NOT file the 7 frontend/API libs (Vidstack,
  TanStack ×2, Uppy, Ark UI, Hono, Drizzle, Zod) — docs suffice there; source-reading is
  question-triggered, not standing. Boundary note: the *method* lives at root (ARD); platform items
  carry it via `research_origin: vendored-source-research-mode` (a slug, boundary-safe), never a link
  to root.
- **Pin-hygiene findings + fix.** Grounding the items surfaced that **tusd runs `:latest` (unpinned
  → v2.9.2)** and SRS/imgproxy use major-only tags (`srs:6`, `imgproxy:v3` → v3.31). Scoped as the
  active `[deploy]` story `pin-docker-compose-image-versions` (operator executes — compose is a
  repo-denied file; SRS exact version needs operator confirm, blocked from `docker exec` into prod).
  postgres `:16` + mailpit `:latest` deliberately left (conventional major-pin / dev-only).
- **Two paired discipline items parked** (prevention + currency — we have neither today):
  `pin-discipline-lint` (a pre-commit hook to block `:latest`/imprecise tags, needs allowlist
  design) and `dependency-currency-strategy` (we have NO Dependabot/Renovate/CI; the LS drift was
  caught by manual research — a real decision pass: bot vs script vs lean on the vendored-source line
  for load-bearing deps, tangled with the no-CI-today fact). Both parked, not built — neither is
  mechanical.

## Resume map

- **Editorial-engine design pass is the next move** (`unified-channel-model-editorial-engine`, still
  `drafting`) — now fully unblocked: spike settled, version question answered, **and the central
  CRUD fork settled** (end of session): channel CRUD = **regenerate-and-restart now, runtime-ready
  later** (the editorial UX is live in both; runtime CRUD bought only gapless structural add/remove
  at a standing-invariant + least-tested-paths cost, not worth it for a rare admin action now; seam
  kept ready via broadcast-output-as-sentinel + pure render + restart-agnostic control plane).
  Recorded in the position §CRUD mechanism + the feature body. **Remaining open fork for the design
  pass: the control plane** (bespoke harbor endpoints vs `interactive.harbor`) + child-story
  decomposition. Soft-depends on the 2.4.5 upgrade story landing first (good hygiene; not a hard
  block for the chosen regenerate-and-restart design — its bugs are latent for v1).
- **Upgrade story is filed and ready** (`research-handoff-...-1`) — small, surgical, revertible.
  **Coordinates with the image-pin story** (`pin-docker-compose-image-versions`) — same hygiene
  theme (Dockerfile `FROM` vs compose tags); can ship together.
- **Image-pin deploy story is actionable now** (`pin-docker-compose-image-versions`) — operator
  edits compose (denied to agents); tusd `:latest`→v2.9.2 is the urgent one. SRS exact version
  still needs operator confirm (`srs -v` on the live container).
- **5 vendored-source `[research]` items in backlog** (SRS, Garage, tusd, imgproxy, pg-boss) —
  acquire+orient, pick up per-need; tusd's source-orient waits on the pin story landing first.
- **2 dependency-discipline items parked** (`pin-discipline-lint`, `dependency-currency-strategy`)
  — the currency one is the bigger gap (no Dependabot/Renovate/CI today) and wants a decision pass.
- ARD v0.6.0 cut now waits on the sixth child (`feature-ard-vendored-source-research-mode`,
  drafting) before the dual-pin move.
- bold-* epics remain design-gated (unchanged).
