---
paths:
  - "**/README.md"
---

# README Discipline

READMEs are **user-facing orientation surfaces**. They serve human readers — people cloning the repo, browsing on the forge, joining as drive-by contributors. AGENTS.md, CLAUDE.md, and the auto-loaded rules in [.claude/rules/](../rules/) serve agents — different audience, different job. Don't conflate them.

## Audience and job

The audience is the human reader who has the file structure in front of them and wants to know what they're looking at. The job is the orientation gap that file structure + agent-facing surfaces don't already cover for that audience.

A README earns its place by filling that gap. If the audience can answer "what is this directory and how do I work with it as a human?" from the file tree alone, the README has no job — and writing one anyway adds noise.

## Common content

What a tier-level README typically does:

- **What this directory is** — one paragraph of orientation. What lives here, why.
- **How to acquire any gitignored material** — the most common reason a human needs the README. Sources, fetch instructions, what survives a clean clone vs. what doesn't.
- **How to read the artifacts as a non-agent** — when the structure inside isn't self-explaining to a human (e.g., a tier with frontmatter conventions, raw fetches alongside processed notes).

When a tier has gitignored material, the README is the recipe. That alone is often the whole job.

## Don't

- **Don't restate agent conventions.** Per-piece shapes, frontmatter schemas, naming patterns — all live in [.claude/rules/](../rules/) or AGENTS.md, where agents auto-load them. Restating in the README creates two sources of truth that drift.
- **Don't duplicate the file tree.** If you find yourself writing an ASCII layout map of the directory's contents, ask whether `ls` would communicate the same thing. Usually yes.
- **Don't document agent workflows.** Workflow conventions (how items move through stages, how scoping works, how reviews run) belong in skills or rules, not in tier READMEs.
- **Don't treat the README as a progress log.** Active item progress, provisional research churn, session learnings — all live in their proper tiers, not as appendages on README updates.

## When to update

A decision changes a claim a README makes (stack pin, naming, tier convention); a tier is introduced or restructured; gitignored material's source URL or fetch recipe changes. AGENTS.md / CLAUDE.md edits often trigger downstream README updates in the same change.

Link-checker passing isn't sufficient — phrasing drifts without breaking links. Periodic accuracy sweeps earn their place after heavy churn (tier introductions, decision revisions, item-tier moves).

## Revisit if

- A README consistently ends up restating agent conventions despite this rule — may indicate the rule isn't loading early enough, or that the agent surface isn't discoverable enough from the human surface.
- A class of README (e.g., per-skill) emerges with consistently different audience needs — may warrant a sub-rule or a carved-out exception.
- The audience model shifts (a scope becomes single-author with no expected human contributors) — README job changes; this rule needs revision.
