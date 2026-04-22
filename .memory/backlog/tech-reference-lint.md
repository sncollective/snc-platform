---
tags: [refactor]
release_binding: null
created: 2026-04-22
---

# Tech Reference Lint

Periodic lint pass over `platform/.claude/skills/<lib>/SKILL.md` — the version-pinned tech-reference skills (hono-v4, drizzle-v0, tanstack-query-v5, zod-v4, ark-ui-v5, garage-v2, etc.). Each skill carries a tacit freshness contract with the installed package version, API surface, and upstream release cadence. Nothing currently checks any of that. Libraries move fast; skills go silently stale.

Karpathy's labor principle applies squarely here: *"The tedious part isn't the reading or thinking — it's the bookkeeping."* Humans can't track upstream for 16 libraries in parallel; an LLM-assisted pass is exactly the asymmetry to exploit.

## Four candidate lint faces

1. **Version-match** (mechanical). Compare `name: <lib>-vN` in `SKILL.md` frontmatter against the installed major version in `package.json`. Flag drift (`hono-v4` skill vs. `hono: ^5.x` installed). Cheap, no LLM, high-signal.

2. **Staleness-by-age** (mechanical). Flag skills whose `updated:` frontmatter is older than a threshold (six months? twelve?). Prompts re-validation even when the major version hasn't moved — minor releases accumulate API surface and gotchas the skill doesn't capture.

3. **Upstream-release-delta** (LLM-heavy, optional). Fetch npm view / GitHub releases / changelogs for the installed version; ask whether recent changelog entries warrant skill updates. Higher token cost; run at lower cadence (monthly?) than the mechanical faces.

4. **Example-compiles** (toolchain-heavy). Extract code blocks from each SKILL.md, typecheck against installed types with `tsc --noEmit`. Catches API-shape drift that version-match misses (e.g. signature changes within a major). Probably too expensive for routine runs; park until the cheaper faces earn their place.

## Scope fit

This is refactor-scan family, not scan-memory. Lint *target* is skill-files + package state, not the `.memory/` substrate. Structurally parallels [scan-design-system-rule-library.md](scan-design-system-rule-library.md) and [scan-conventions-rule-library.md](scan-conventions-rule-library.md) — scan libraries under `/refactor-scan` rather than memory-side lints.

Possible shape when picked up: one platform feature or epic carrying the four faces, each as a rule library or child feature depending on scope at design time. Mechanical faces likely ship first; LLM-heavy faces trial-shaped like scan-memory-decision-freshness.

## Source

Surfaced 2026-04-22 in the scan-memory-mechanical implementation session, when stepping back to ask whether the Karpathy three-op model had been applied beyond `.memory/`. The mechanical and research tiers had partial coverage; the tech-reference tier had none despite being the area with highest drift velocity.
