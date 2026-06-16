---
id: dependency-currency-strategy
kind: backlog
tags: [workflow, deploy]
created: 2026-06-16
---

# Dependency-currency strategy — how we detect and incorporate version bumps

Parked for a decision pass (not yet built). We have **no dependency-currency machinery** — no
Dependabot, no Renovate, no CI workflows at all (`.github/workflows/` is empty). The Liquidsoap
2.4.2 → 2.4.5 drift was caught by *manual research* (the `liquidsoap-version-capability-audit`
campaign), not by any tool. That worked for one load-bearing dependency but doesn't scale: pins go
stale silently across npm + Docker images + (eventual) GitHub Actions.

This is the **currency** half (the prevention half is `pin-discipline-lint`). They're paired
opposites: pinning makes us reproducible-but-stale; currency-checking fights the staleness. A good
discipline needs both.

## The decision to make (evaluate, then pick)

1. **Adopt Renovate or Dependabot** — config, not code; both handle npm + Docker image tags +
   GitHub Actions and open version-bump PRs on drift. Mature, standard. **Caveat: we have no CI
   today** to validate the PRs they'd open — so this may want CI-first, or accept human-validated
   bump PRs. Renovate is more configurable (grouping, schedules, automerge policies); Dependabot is
   simpler + GitHub-native.
2. **Lightweight tag-check script** — a periodic `scripts/check-version-drift.py` that reads our
   pins (compose, `package.json`, Dockerfiles), queries upstream latest tags, and *reports* drift
   without auto-PRs. Less noise, no bot; but bespoke and we maintain it.
3. **The vendored-source-research line for the deep cases.** The vendored-source research mode (a
   root/ARD method, applied in the `research-*-vendored-source` items) IS already a currency
   mechanism for *load-bearing* dependencies — it's how the LS drift surfaced. So the real design
   question is **where the line sits**: a bot/script handles routine currency (flag that X moved);
   a research engagement handles "should we actually take this bump, what breaks" for the
   load-bearing few (the LS audit shape). Don't build a tool that tries to do the research half.

## Open questions for the decision pass
- Do we want auto-PR bots (Renovate/Dependabot) or report-only (script)? Interacts with how much
  PR noise is tolerable and whether CI exists to gate them.
- CI-first? A bump PR with no test suite to run against is low-confidence. May couple to a
  "bootstrap CI" decision.
- Scope: npm only, or npm + Docker images + Actions? The Docker-image drift (the LS/tusd case) is
  the live pain; npm drift is lower-stakes day-to-day.

## Why parked
A real architecture choice, not a mechanical add — it interacts with the no-CI-today fact and the
auto-PR-noise tolerance, and overlaps the vendored-source research line. Decide deliberately.
Pairs with `pin-discipline-lint` (prevention).
