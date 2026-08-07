# Mockup visual verification (force-loaded constraint)

The orchestrator model is **not multimodal** — it cannot see rendered mockups
(HTML/PNG). This rule is force-loaded so the constraint is always in context.

**Before reporting any mockup (`.mockups/**`) "verified" or "done," it MUST be
screenshot + visually checked by a vision-capable subagent**
(`openai-codex/gpt-5.6-sol` — multimodal):
- a **correctness validator** (no horizontal overflow / off-edge images;
  centered; no duplicated content; interactive bits work; responsive at a narrow
  width), AND
- for locked/candidate mockups, an **adversarial design reviewer** (red-teams
  the design — hierarchy, spacing, type, contrast, composition).

**Pair every visual check with a code `grep` on exact strings** (emails,
domains, URLs) — the visual pass reads rendered text but misses subtle character
differences.

The full procedure — the LAN preview server recipe (port + pid gotchas), the
firefox-headless screenshot recipe (Playwright browsers are NOT installed), and
the validator + adversarial-reviewer briefs — lives in
`.agents/skills/mockup-review/SKILL.md`. **Load that skill for any mockup work.**

(Hard-won: a centering/overflow bug and an `snc.org`/`s-nc.org` domain typo both
shipped past a subagent's "verified" claim — this rule + skill exist to prevent
that recurrence.)
