---
name: release-create
description: "Scaffold a new release bundle file at .work/releases/<version>.md with status: planned. Detects prior releases to suggest next version; optionally pre-binds already-reviewed items to this release. Use when planning a new release, 'create release', 'new point release', 'start 0.2.3'."
argument-hint: "[version]"
---

# release-create — Scaffold a New Release Bundle

Create a release bundle file at the `.work/releases/` tier. Item binding flows through `/review` at review-pass; `/release-create` can optionally pre-bind already-reviewed items at creation time.

See:
- `.work/CONVENTIONS.md` — item + release structure, `§Frontmatter — release tier` for the schema.
- `.work/CONVENTIONS.md` — `§Release binding lifecycle`.

## Step 1: Parse Arguments

- **Version** — e.g. `0.2.3`. Required.

## Step 2: Detect Previous Releases

Glob `.work/releases/*.md`. Parse versions; identify the latest.

If `<version>` not given, suggest patch increment. If no prior releases, suggest the documented starting version — check `AGENTS.md §Release Versioning`.

Confirm:
> *"Latest release: {prev}. Next: **{suggested}**? (or provide a different version)"*

## Step 3: Collect Already-Bound Items

Glob `.work/active/**/{feature,story}.md` + `.work/releases/<version>.md` — filter by `release_binding: <version>`.

If items exist, they're the starting set for this release (bound proactively, or from gate findings at creation).

## Step 4: Optional Pre-Bind Pass

List items at `stage: review` (passed acceptance, awaiting binding) or `stage: done` without binding. Ask user:
> *"{N} items at review ready for binding. {M} done items without release binding. Bind any to `{version}`?"*

If user picks items, set `release_binding: <version>` in each item's frontmatter.

Skippable — user may prefer to bind items later at review-pass (via `/review`'s binding prompt).

## Step 5: Write Release File

Create `.work/releases/<version>.md`:

```yaml
---
version: <version>
status: planned
created: <today>
updated: <today>
quality_gates_passed: []
related_items: [<slugs from Step 3 + 4>]
---

# Release <version>{ — Theme if user provided}

{Overview paragraph — what this release is about. User can extend.}

## Bundle summary

{Auto-computed — list of bound items. Updated as items bind/unbind pre-ship.}

## Prod verification

_(appended to by `/review` as items pass review with residual prod-only checks — caveats that can only be proven against the deployed prod environment. Walked post-deploy; failures spawn new fix items.)_

## Changelog

_(written during `/release-deploy` after gates pass)_

## Known issues

_(written during `/release-deploy` if any)_
```

Theme and overview are user-provided or inferred from bound items. Keep minimal at create-time; `/release-deploy` fills in the changelog and known issues during its release-plan step. `## Prod verification` starts empty; `/review` lifts residual prod-only caveats into it as items pass.

## Step 6: Report

> *"Release `{version}` created at `.work/releases/{version}.md`.*
>
> *Status: planned. Bound items: {N}. Bind more at review-pass via `/review` or manually edit `release_binding` in item frontmatter.*
>
> *Next steps:*
> - *`/review` — accept + bind items as they pass review.*
> - *`/release-deploy {version}` — when ready to run gates + ship."*

## Anti-Patterns

- **Don't copy items from prior release boards.** The board model is retired. Unfinished items stay in `.work/active/` and bind to whichever release they pass review against.
- **Don't auto-archive the previous release.** Archival happens in `/release-deploy` for shipped releases, not at create-time for new ones.
- **Don't skip version validation.** Malformed versions (non-semver) surface; ask user to confirm or correct.
- **Don't silently bind items the user didn't select.** Step 4 is opt-in; default is empty bundle, items flow in via `/review`.
