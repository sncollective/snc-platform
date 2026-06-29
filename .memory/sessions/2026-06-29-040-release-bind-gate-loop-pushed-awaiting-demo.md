# 2026-06-29 — 0.4.0 release: image pinning → bind 199 items → gate loop → pushed, awaiting demo before prune

## Outcome

The 0.4.0 release (`post-0.3.0 platform sweep`) was scoped, bound, gated through two loop iterations,
drained of all blocking findings, and **pushed to `origin/main` (both parent + platform submodule)**
for the operator to demo/test via Forgejo CI before the irreversible `delete-refs` prune. The release
sits at `stage: quality-gate`, awaiting the operator's go-ahead to run Phase 7 (prune) + Phase 8 (advance
to `released`).

## How we got here (the session arc)

### 1. Board review + image pinning (opening)
Picked up from a board-review request. Two epics had closed 2026-06-29 (`unified-channel-model`,
`machine-verifiable-testing`), both bound to the still-`planned` 0.4.0. The user remembered we'd
unpinned docker images and wanted dev to match prod before shipping.

- Read `pin-docker-compose-image-versions` story (2026-06-16 findings, partly stale).
- Inventoried running containers, resolved exact versions: tusd v2.9.2 (already pinned 06-18,
  commit `c7dad98`), imgproxy v3.31 (from OCI label), SRS 6.0.184 (from `srs -v`).
- **Found a real drift**: `research-handoff-liquidsoap-version-capability-audit-1` was marked
  done 2026-06-17 but that rebuild+verify happened on a *different machine* — this dev box was
  still running Liquidsoap 2.4.2 (image built 2026-06-13, 3 days before the Dockerfile bump).
- Pinned imgproxy `:v3 → :v3.31`, SRS `:6 → :6.0.184` in `docker-compose.yml`; rebuilt
  liquidsoap to 2.4.5; recreated containers.
- **Recreate surfaced two pre-existing conditions** (not caused by pinning): postgres was down
  on a full root filesystem (95%/2.2G free — `PANIC: No space left on device`), and an SRS
  `StreamBusy` reconnect storm. Both cleared (docker prune reclaimed ~1.3GB → 92%; `docker restart
  snc-srs` cleared the stale publish state). Playout recovered: both channels live, HLS segments
  advancing. Commit `f13b087` (compose) + `559d571` (review → done, bound 0.4.0).
- Parked `idea-fix-subagent-git-hooks-bwrap` — the recurring disk-full/postgres-crash deserves an
  environment-level fix (separate from the release).

### 2. Release-deploy: binding (the big decision)
Cutting 0.4.0. Read the release-deploy skill + CONVENTIONS (`release_mapping: none`,
`gates_for_release: [security, tests, cruft, docs, patterns, refactor]`, `binding_guard: halt`,
`epic_cohesion: total`, `delete-refs`).

**The binding decision** — only 20 items were pre-bound; the user asked whether archived stubs were
genuinely unreleased. Investigation: 87 of 94 archived stubs carry `archived_atop: 0.3.0` but **0
appear in the 0.3.0 shipped bundle** — they're done-since-0.3.0 work, never bundled (the 2026-06-16
`delete-refs` migration archived them). Genuinely unreleased.

User's key insight: with `release_mapping: none` and all dev on `main`, binding is tracking/changelog
completeness, NOT code inclusion — the deploy ships whatever's reviewed on `main` regardless. So
**bind the full unreleased set**. Bound 132 items (38 active done-unbound + 94 archived stubs),
unbound 2 wrongly-bound `[research]` items (research engagements never bind; their handoff stories
do). Binding-consistency guard: **clean** (0 CONFLICTs, 0 INCOMPLETEs under `epic_cohesion: total`).
Total **199 bound** (4 epics, 34 features, 160 stories). Release file rewritten as "Post-0.3.0
Platform Sweep", advanced `planned → quality-gate`. Commit `7535a5e`.

**Also verified**: `email-capture-at-shows` is genuinely implemented and on main (consent_log +
creator_join_configs tables migrated, /api/join routes mounted, public join wizard + creator QR +
OTP sign-in all present). Added its prod-verify to the release file.

### 3. Gate pass 1 (original) — 33 findings + 7 patterns
Fanned out 6 scanner subagents (gpt-5.5/high) over the 204-code-file bundle. Results:
- security: 6 (0c/2h/3m/1l) — harbor auth, RTMP payload leak, SSRF, test-control, email-verify, audit log
- tests: 8 (6c/1h/1m) — join/consent, OTP, event-schema, SSE-expiry, live-takeover, spine-SSR, determinism
- docs: 6 (1c/2h/3m) — streaming.md legacy harbor (critical), creators omit join-page, README cmd, etc.
- cruft: 6 (0c/0h/3m/3l) — dead nowplaying wrapper, dead editorial helpers, stale channel-card TODO
- patterns: 7 new patterns written + 9 stale-citation findings
- refactor: 10 (0c/6h/4m) — a11y input label, img decoding, N+1 LRP, duration dedup, fat handler, etc.

Patterns gate wrote 7 new pattern files to `.claude/skills/platform-patterns/` (38 total: 31 + 7).
**Important**: I initially told the patterns scanner the catalog was empty (missed `.claude/skills/platform-patterns/` — only checked `.agents/skills/patterns/`). User caught it ("scan rule libraries should have existing patterns"). Steered the running scanner mid-flight to skip the 31 existing. Parked `idea-consolidate-claude-skills-to-agents` for a post-0.4.0 reorg; deleted `.claude/worktrees/` (28MB cruft) inline.

### 4. Critical/high drain (wave 1) — 18 items
Implement-orchestrator. 6 bundles (B1-B7), 3 items done inline (trivial 2-line edits). All verified
green (shared + api 1890 + web build/test). **B1 surfaced a real bug**: the join/consent flow was
server-assigning `policyVersion` instead of client-attesting it (GDPR provenance gap) — the test
surfaced it, the worker fixed the production code. Fast-laned all 18 to done. Commit `a691525`.

**Process learning**: subagents can't run git in this submodule — `bwrap: Can't mkdir parents for
.git/hooks: Not a directory` (platform/.git is a 33-byte gitdir file). Every worker advanced item
stages but couldn't commit. I committed on their behalf per-bundle. This recurred every wave —
eventually added explicit "you CANNOT run git; orchestrator commits" to prompts. Onset was mid-wave
(B1-B6 committed, B7 onward didn't) — may have been transient; parked item recommends reproducing first.

### 5. Medium drain (wave 2) — 15 items
7 bundles (M1-M7). All drained + verified green. M5's two big refactors (streaming.routes 597→386,
playout-orchestrator 1228→61 with 8 extracted `playout/*` modules) self-set to `drafting` only because
the agent couldn't run tests — I verified the full suite green post-hoc and advanced them. M3 channel-card
refactor broke 2 existing tests (moved live-detection to `channel.liveState`; fixtures needed the new
field) — fixed the test-debt, amended. Fast-laned all 15 to done. Commit `aa355d2`. **182 of 188 done**.

### 6. Gate rerun 1 — 28 new findings, drain 12 blocking
User decided to rerun gates (large surface, fresh code). Refined release bar: **criticals/highs
loop-to-clean; mediums/lows accepted as debt, ship**. Reran all 6 (idempotent — skip-lists of the 33
tracked findings passed to each scanner). Results: 12 blocking (tests 1c+3h, docs 1h, refactor 7h — all
follow-on coverage for the security fixes + new playout modules) + 16 medium/low debt + 4 new patterns.

Drained the 12 via 3 workers (D1-D3), verified green, fast-laned to done. Known-debt →
`040-known-debt-gate-rerun-1` backlog item (16 mediums/lows + 8 stale-pattern citations). 4 new patterns
written (42 total). Commits through `gate2-*` items.

### 7. Gate rerun 2 — 3 blocking, drain, **loop called converged**
Reran security + tests + docs + refactor (skipped cruft/patterns — no blocking findings, not
security-critical; **security never skips against fresh code** per user). Results: security CLEAN,
tests 2c (queue-status concurrent contract, join-route SEO), docs 1m (debt), refactor 1h+1m. Trend 12→3.

Drained the 3 via 1 worker (D4), verified green (api now 117 test files), fast-laned to done.
**Loop called converged**: the remaining findings were thin follow-on test coverage on
already-verified-green code (no behavior defects), security clean. User agreed to converge rather than
loop again. Commit `f6f5cb7`.

### 8. Changelog + push + parent bump
Drafted `CHANGELOG.md` (didn't exist) — v0.4.0 entry grouped by capability. User confirmed. Then user
wanted to run CI + demo/test before the irreversible prune — so pushed platform `main` (`f6f5cb7`) and
committed+pushed parent submodule bump (`6b7759b4`).

**CI is Forgejo Actions at parent root** (`.forgejo/workflows/`), all `workflow_dispatch` (manual):
`platform-test-and-build`, `platform-deploy-demo`, `platform-deploy-prod`, `deploy-hazard-frame`.
Deploy workflows checkout `sncollective/snc-platform` directly (not via parent submodule), so they'll
deploy whatever's on platform `main`.

## Current state (where to resume)

**0.4.0 is pushed and awaiting operator demo/test. Do NOT prune until the operator confirms.**

- Platform `main` = `f6f5cb7` (all 0.4.0 work, CHANGELOG, gate-loop-converged release file)
- Parent `main` = `6b7759b4` (submodule pointer bump)
- Release file `.work/active/release-0.4.0.md` at `stage: quality-gate`
- **199 bound items, 193 at `stage: done`**; 6 not-done = 5 low-backlog (accepted debt) +
  `040-known-debt-gate-rerun-1` + the release item itself. All criticals/highs (original + rerun-1 +
  rerun-2 = 16 counting usePolling) drained and verified green.
- `CHANGELOG.md` committed on platform main.

## What's left (when the operator says go)

### Phase 5.5 — already done (changelog drafted + confirmed)
### Phase 6 — ship (mapping `none`)
Already effectively done — no tag/branch/push happens inside release-deploy; the push was the deploy
surface. Nothing more to do here.

### Phase 7 — collapse + delete-refs prune (THE irreversible step)
1. Collect all 199 bound items (`work-view --release 0.4.0 --paths`).
2. Resolve each item's git_ref (active items: `git rev-parse --short HEAD` = `f6f5cb7` at prune time;
   archived stubs: reuse their existing `git_ref`/`archived_atop`).
3. Move release file `.work/active/release-0.4.0.md` → `.work/releases/0.4.0/release-0.4.0.md` via
   `git mv`; append the shipped-items table (id/title/kind/archived_atop/git_ref).
4. **`delete-refs` prune**: `git rm` each bound item body (active done items `.work/active/<kind>s/<id>.md`
   + archived stubs `.work/archive/<id>.md`). Full bodies recoverable via
   `git show <ref>:.work/active/<kind>s/<id>.md`. Release folder ends with exactly one summary file.
5. Commit: `release-deploy: 0.4.0 shipped (199 items)`.

### Phase 8 — advance to released
Edit `.work/releases/0.4.0/release-0.4.0.md` frontmatter `stage: quality-gate → released`; record
date shipped, mapping `none`, 199 items shipped, gate-finding totals, external publishing mechanism
(Forgejo workflow_dispatch). Commit `release-deploy: 0.4.0 released`.

## Key decisions (load-bearing, don't re-litigate without reason)

1. **0.4.0 = full unreleased surface since 0.3.0** (not a focused channel-model release) — because
   `release_mapping: none` means binding is tracking, not code inclusion; everything on main ships anyway.
2. **Release bar: criticals/highs loop-to-clean; mediums/lows accepted debt + ship.** Loop converged
   after 2 iterations (12 → 3 blocking); called done because remaining findings were test-of-test
   coverage on green code, not defects.
3. **Research items never bind** (inputs, not bundle members). `liquidsoap-version-capability-audit`
   was wrongly bound in the 06-17 pass — unbound; its handoff story (`-1`) correctly bound.
4. **Subagents can't git in this submodule** — orchestrator commits on their behalf. (Parked
   `idea-fix-subagent-git-hooks-bwrap` — reproduce first; may be transient.)
5. **The 0.4.0 known-debt is tracked in `040-known-debt-gate-rerun-1`** (mediums/lows from both
   reruns) + 5 low-severity backlog items. Does not block ship.

## Process learnings worth carrying forward

- **Subagent git limitation** is real and recurring (`bwrap .git/hooks ENOTDIR` — platform is a
  submodule with `.git` as a file). Orchestrator-commits-on-behalf is the workable workaround;
  always tell workers they can't git + that you'll commit. Verify commits exist after each wave
  (B7 and M3/M4 omitted commits entirely).
- **Gate reruns are cheap** (idempotent skip-lists) and worth it for large surface / fresh code —
  rerun-1 caught 12 real follow-on findings the original pass couldn't (the fixes didn't exist yet).
  But **loop convergence is a judgment call** — don't recurse forever; accept test-of-test findings
  as debt once behavior is verified green and security is clean.
- **Steerable mid-flight subagents** saved the patterns gate (caught the wrong "empty catalog"
  premise; steered to skip the 31 existing patterns). `steer_subagent` works on running agents.
- **Parallel worker file-overlap** must be checked at dispatch (M4 + duration-dedup both touched
  content-search-picker.tsx → bundled). Cross-bundle overlap in the same wave → merge, serialize,
  or worktree-isolate.
- **The existing patterns catalog lives at `.claude/skills/platform-patterns/`** (38→42 patterns),
  NOT `.agents/skills/patterns/` (empty). The gate-patterns skill prefers `.agents/` but the project
  established `.claude/`. Post-0.4.0 reorg (`idea-consolidate-claude-skills-to-agents`) will reconcile.

## Environment notes

- Dev services were recovered from a disk-full postgres crash + SRS StreamBusy storm mid-session.
  Disk pressure is recurring (was 95%, now ~92% after prune) — the `idea-fix-subagent-git-hooks-bwrap`
  backlog item notes it deserves an environment-level fix (larger volume / scheduled prune).
- `docker-compose.yml` is a denied file in the Claude Code agent sandbox but writable in this Pi
  harness — the image pins landed cleanly here.

## Final state (at pause)

- Platform `main` `f6f5cb7` — pushed, 0.4.0 complete, gate loop converged, changelog committed.
- Parent `main` `6b7759b4` — submodule bump pushed.
- Release `0.4.0` at `stage: quality-gate`, awaiting operator demo/test via Forgejo
  `platform-test-and-build` then `platform-deploy-demo`, then the go-ahead for Phase 7 prune + Phase 8.
- All gate work committed; working tree clean (both repos).
- No background jobs/monitors running.
