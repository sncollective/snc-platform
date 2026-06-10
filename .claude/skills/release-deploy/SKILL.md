---
name: release-deploy
description: "Orchestrate the quality-gate sequence + release plan + CI + ship for a release. Runs gates sequentially (refactor → security → testing → documentation), writes the release plan, runs CI, flips status to released, and archives bound items from active tier into the release tier. Idempotent — re-invoke after resolving gate findings or CI failures. Use when ready to ship a version: 'deploy 0.2.1', 'ship release', 'run release gates'."
argument-hint: "[version]"
---

# release-deploy — Gate Sequence + Ship Orchestrator

You walk a release from `planned` → `quality-gate` → `released` via the gate sequence, release-plan writing, CI run, and item archival. Sequential phases; each phase's failures block progression. Idempotent — re-invoke after fixing gate findings or CI failures to pick up where you left off.

See:
- `.work/CONVENTIONS.md` — item + release structure, `§Where matter lives`, `§Frontmatter — release tier` for the schema.
- `.work/CONVENTIONS.md` — `§Release binding lifecycle`, `§Quality gates live on releases`.

## Step 1: Parse Arguments + Load Release

- **Version** — required.

Read `.work/releases/<version>.md`. Refuse if:
- File doesn't exist — user should run `/release-create` first.
- `status: released` — release already shipped; nothing to do.

Collect all items with `release_binding: <version>`:
- Active tier: `.work/active/**/{feature,story}.md` filtered by binding.
- Release tier (for re-invocation mid-gate): `.work/releases/<version>/**/{feature,story}.md` if already moved.

## Step 2: Verify Bindings

Non-gate items bound to `<version>` should be at `stage: done` before gates run. If feature/story items are still `drafting`/`implementing`/`review`, report and stop:
> *"Item `<slug>` bound to {version} is at stage: {stage}. Complete review before running release gates, or unbind."*

Gate findings (items with `release_binding: <version>` from scans) may be in any stage — they're being worked during the gate phase.

## Step 3: Flip to `quality-gate`

If release `status: planned`, flip to `quality-gate`. Update `updated:` timestamp.

Already at `quality-gate` → continue (re-invocation after earlier failure).

## Step 4: Run Gate Sequence Sequentially

Gates run in strict order. Each gate must clear (no findings at stages before `done`) before the next runs. `quality_gates_passed:` in release frontmatter tracks progress; re-invocation skips already-cleared gates.

### Gate 4a: Refactor

If `refactor` not in `quality_gates_passed`:
- Invoke `/refactor-scan --release=<version>` via Skill tool.
- Wait for completion. If findings were created, surface count and ask user to resolve them (via `/implement` + `/review`) before proceeding.
- After all refactor-tagged items with `release_binding: <version>` are `done`, append `refactor` to `quality_gates_passed`.

### Gate 4b: Security

If `security` not in `quality_gates_passed`:
- Invoke `/security-scan --release=<version>`.
- Same flow: wait, surface findings, resolve, update `quality_gates_passed`.

### Gate 4c: Testing

If `testing` not in `quality_gates_passed`:
- Invoke `/e2e-triage --release=<version>`.
- Same flow.

### Gate 4d: Documentation

If `documentation` not in `quality_gates_passed`:
- Invoke `/docs-triage --release=<version>`.
- Same flow.

**Stop at any gate with unresolved findings.** Release stays at `quality-gate`; user addresses findings; re-invoke `/release-deploy`.

## Step 5: Write Release Plan

After all four gates clear, extend the release file's matter:

- **Bundle summary** — list of bound items with one-line descriptions.
- **Changelog** — per-item summary of what shipped. Extract from each item's matter.
- **Known issues** — any deferred-to-next-release items (unbound findings, known gaps).
- **Deploy runbook** — reference to `AGENTS.md §Agent Commands` for actual deployment.

## Step 6: Run CI

Execute CI commands (from `AGENTS.md §Agent Commands` — typically `test-all`, `build`, `lint`). This catches interactions between separately-implemented items.

If CI fails, release stays at `quality-gate`. Surface failures; user investigates; re-invoke.

## Step 7: Flip to `released`

Update release file frontmatter:
- `status: quality-gate` → `released`
- `updated: <today>`

## Step 8: Archive Released Items

For each bound item still in active tier:

```bash
git mv .work/active/<slug>/ .work/releases/<version>/<slug>/
```

Items retain frontmatter (`stage: done`, `release_binding: <version>`). Only the path changes. Folder structure preserved for archaeology.

Update release file's `related_items:` list to the moved paths (snapshot).

Active tier stays bounded; released items live in the release tier alongside the bundle file.

## Step 9: Report + Handoff

> *"Release `{version}` shipped. {N} items archived to `.work/releases/{version}/`.*
>
> *Gates passed: refactor, security, testing, documentation.*
> *CI: passed.*
>
> *Next:*
> - *Infrastructure deploy: {Agent Commands reference, or "user-station work"}.*
> - *`/release-create` for the next version when ready."*

Actual production infrastructure deploy (push to prod, DNS updates, etc.) is user-station work — out of this skill's scope.

## Idempotence

Re-invocation after failure or interruption:
- Reads `quality_gates_passed:` to skip already-cleared gates.
- Reads current `status:` to resume at the right phase.
- Safe to run repeatedly; only advances state when the current phase cleanly clears.

## Anti-Patterns

- **Don't run gates in parallel.** The sequence is strict: refactor → security → testing → documentation. Each gate's findings must be clean before the next.
- **Don't advise-instead-of-block on gate findings.** Findings bound to the release are release-blockers by definition. User unbinds (manually edits frontmatter) to defer.
- **Don't skip CI after gates pass.** Gates check domain-specific quality; CI catches cross-item regressions. Both required.
- **Don't auto-archive if CI fails.** Archival happens only after `released` status is set.
- **Don't archive release file itself.** The `<version>.md` file stays in place as the durable record. Items move to the sibling `<version>/` directory.
- **Don't actually deploy to production.** The skill marks `released`; user-station work does the infra push.
- **Don't auto-create the next release.** Suggest in report; let user decide.
- **Don't proceed with items at `review`/`drafting`/`implementing` bound to the release** — they must be `done` before gates run. Gate findings are the exception (they're created during the gate phase and worked through).
