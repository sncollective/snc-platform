---
name: review
description: "User-driven acceptance review for a feature, standalone story, or epic at stage: review. Runs kind-conditional flow — code-based feature/story gets pre-flight + acceptance testing + triage; epic gets architectural sign-off against its brief. Handles finding triage, release binding, stage flip to done. Use when an item is at review. Trigger on 'let me test this', 'review the changes', 'review this', or with an item path/slug as argument."
argument-hint: "[feature-path|story-path|epic-path|slug]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Skill
model: opus
---

# review — Acceptance Review + Stage Sign-Off

You run an interactive acceptance review for an item at `stage: review`. Kind determines the flow. The outcome is a stage transition (`review → done`, or back to a prior stage if blocking), release binding, and any follow-on backlog/active items surfaced from triage.

See:
- `.claude/rules/item-convention.md` — item structure, `§Where matter lives` (kind-files live; grounded revision allowed)
- `.claude/rules/item-pipelines.md` — `§Stage semantics` (review = qualified-reviewer sign-off; skip-with-note escape for items user can't meaningfully review), `§Release binding lifecycle` (binding set at review-pass for features/stories)
- `.claude/rules/tag-taxonomy.md` — `§Scope resolution` (forwarding to testing/documentation backlogs)

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:
- **Item path** — feature.md / story.md / epic.md. Use it.
- **Slug** — resolve by globbing `.work/active/**/{epic,feature,story}.md` (and `.work/active/{epics,features,stories}/*.md`) and matching the slug.
- **No args** — glob items at `stage: review`. If one, use it. If multiple, ask user.

## Step 1: Refuse Non-Applicable Targets

- **Task** → refuse: *"Tasks review as part of their parent's cycle; not targeted directly."*
- **Feature/story/epic at `drafting` or `implementing`** → refuse: *"Item at [stage]; run `/design` or `/implement` first."*
- **Already at `done`** → refuse: *"Item is done. Re-open by manual stage edit if re-reviewing."*

Workflow/md-heavy items at `review` are **allowed**. The read-through flow (Step 5c) handles them.

## Step 2: Resolve Flow (Kind Conditional)

Three flows:

**(a) Code-based feature or story** — pre-flight dev env, acceptance testing, triage. Steps 3 + 4a + 5a + 6 + 6.5 + 7 + 8 + 9 + 10.

**(b) Epic** — architectural sign-off against the epic's brief. No dev env. Steps 4b + 5b + 6 + 6.5 + 7 (optional) + 8 + 10.

**(c) Workflow/md-heavy item** — read-through sign-off. No dev env, no golden-path forwarding. Steps 4c + 5c + 6 + 6.5 + 8 + 10.

Detect kind from frontmatter; detect whether the deliverable is code (feature/story with a code-domain tag) vs workflow/md-heavy (tag `workflow`, no code-domain tag).

## Step 3: Pre-flight (Flow (a) Only)

Ensure dev env is ready for testing:

1. **Run migrations** (if the project has a `db:migrate` or equivalent Agent Command).
2. **Restart services** (if the project has `dev-restart` or equivalent).
3. **Verify services** (if the project has `dev-status` or equivalent).

Report results. If migrations failed or services won't start, stop and surface the error — don't test against a broken env.

If the project has no Agent Commands section in its CLAUDE.md, infer from prose or skip pre-flight with a note to the user.

## Step 4: Load Context

**(4a) Feature or story target:** kind-file matter, parent epic.md if nested, child story matter (if feature), design matter within the kind-file.

**(4b) Epic target:** epic.md matter, all child feature/story kind-files + their design sections.

**(4c) Workflow/md-heavy item:** kind-file matter, parent chain if nested.

Summarize what's under review for the user before the session starts.

## Step 5: Acceptance Session

**(5a) Feature or story — testing session:**

> *"The app is running. Go ahead and test — tell me what you find."*

Open-ended conversation. Use `AskUserQuestion` to gather findings. After each finding, reflect back a tightened version:

> *"Got it — {restated finding}. Anything else, or should we triage so far?"*

Also ask explicitly what passed acceptance. Don't rush to triage; let the user drive pace.

**(5b) Epic — read-through:**

Walk the user through the epic's brief and landed children:

> *"Brief said X. Y has landed. Does the landed work match what you expected the brief to produce? Anything missing from the brief's commitments? Any principle now looks wrong against what actually shipped?"*

Gather findings as the user reads through.

**(5c) Workflow/md-heavy item — read-through:**

Show the user the kind-file matter and any landed artifacts. Ask whether it matches expectations; any gap or drift.

## Step 6: Triage Findings

Each finding categorized per outcome matrix:

| Category | Resolution | Effect on review | Release binding |
|---|---|---|---|
| **Fix-in-flight** | Fix now in-session; kind-file matter revised in place. **Resolution is pending user re-verification** — see Step 6.5. Finding is not "resolved" until the user confirms the fix closed the gap. | Review passes only after all fixes re-verified | Set at pass |
| **Non-blocking defer** | Park to backlog (via `/item-park` or inline write) with relevant tag; or scope as new active work (user choice) | Review still passes | Set at pass |
| **Design gap surfaced** | Feature's design is wrong; item goes back to `stage: drafting`; `/design` re-runs | **Review does not pass** | Not set |
| **Architectural gap surfaced** | Epic brief needs revision (grounded parent revision per `item-convention.md`); may reshape feature or epic. May require scoping a new child via `/scope` at the same release so epic rollup can close — see Step 8 item 5. | **Review does not pass** at feature level; may escalate to epic-level | Not set |
| **User cannot meaningfully review** | Per `§Stage semantics`, skip review with a note. Applies to items in classes the user lacks context for (security-tagged findings, deep technical convention shifts). Anticipates future specialized review agents filling the reviewer role. | Review "passes" with skip-note in matter | User's call (typically set) |
| **Prod-only residual** | Aspect can only be proven against the deployed prod environment (real SMTP relay, real OAuth creds, real user roles not fakeable in dev, physical hardware). Lift into the bound release bundle's `## Prod verification` section as a checkbox line; the item itself passes review and archives on `/release-deploy` normally. The open check lives on the release bundle until walked post-deploy. | Review still passes | Required (must be bound — bundle is where the check lands) |

Interactive: propose a category per finding, confirm with user. Don't pre-write anything before the triage list is confirmed.

## Step 6.5: Verify Fix-In-Flight (Loopback)

For each finding categorized as fix-in-flight, after the fix lands:

1. Tell the user concisely what changed — file + one-line summary, not a wall of diff.
2. Ask the user to re-verify the specific spot — *"Reload {route} / test {flow} — does it read clean now?"* Be specific about what to check.
3. If the user confirms: mark the finding resolved; continue.
4. If the user reports the fix is incomplete or introduced new issues: re-open the finding. Either iterate the fix (another pass through 6.5 loop), or re-categorize (defer to backlog, scope new work, mark as blocking).
5. Only mark a fix-in-flight as resolved with explicit user confirmation.

**The default rule: anything the user could verify must be verified by the user before that finding counts as resolved.** This applies to visual, behavioral, functional, UX, and interaction-level fixes — not just visual ones.

**Exception:** a fix that's demonstrably not user-verifiable resolves without re-verification. Qualifying classes: internal refactor with no surface-level behavior change, typo fix in a code comment, pure test addition, docstring rewording, dependency-lock bump with no runtime effect. The default assumption is "user-verifiable until proven otherwise" — if in doubt, loop.

No item passes review while any fix-in-flight remains un-verified. This step iterates as many times as the fix needs.

## Step 7: Release Binding (Passed Items Only)

Per `§Release binding lifecycle`, binding is set at review-pass for features/stories. Platform ships versioned releases, so passed feature/story items bind to a release.

For each item that passed review:
- Ask user which release to bind to. Default suggestion: most recent planned release (if a release file exists in `.work/releases/`). Allow skip ("bind later") via manual edit.
- Set `release_binding: <version>` on the item's frontmatter.

Epics: release binding is optional at sign-off; typically not set unless the epic itself ships as a unit.

Gate-finding exception: if the item had `release_binding` already set (inherited from a backlog gate finding), respect; don't overwrite unless user explicitly rebinds.

## Step 8: Write Changes

After triage + binding confirmed by user:

1. **Passed items** — flip `stage: review → done`. Update `updated:` in frontmatter. Set `release_binding` if confirmed in Step 7.
2. **Skip-with-note items** — flip `review → done` with a matter-note explaining the skip (reviewer class user couldn't cover; specialized reviewer TBD).
3. **Blocking findings (design gap, architectural gap)** — flip item back to `stage: drafting` (or `implementing`, per the gap's depth). Add matter-note summarizing the gap. Don't set `release_binding`.
4. **Non-blocking findings parked** — create backlog items at `.work/backlog/<slug>.md` with appropriate tags. Follow `§Scope resolution`.
5. **Non-blocking findings scoped as new active work** — invoke `/scope` via Skill tool (user confirms). **Do not hand-write the item.** `/scope` handles kind sizing (story vs feature), stage assignment (stories go to `implementing`, features to `drafting`), and the handoff line ( `/implement` for stories, `/design` for features) correctly. Hand-writing risks wrong-stage (drafting on a story that should be at implementing) or wrong-handoff (calling out `/design` on a story, which `/design` correctly refuses). This applies equally to architectural-gap-surfaced findings that need a new child story to unblock epic rollup.
6. **In-place matter revisions** — edit the item's kind-file matter directly for clarifications / missed edge cases that the fix-in-flight already addressed.
7. **Prod-only residuals** — for each finding categorized as prod-only, append a checkbox line to the bound release bundle's `## Prod verification` section. Format: `- [ ] **{item-slug}** — {concrete check phrasing}`. Group multiple residuals from the same item on consecutive lines under one slug. If the bundle has no `## Prod verification` section yet (older bundle), insert one after `## Bundle summary`. The item itself still flips `review → done` — the open check lives on the release bundle, not the item. Refuse this triage category for items without `release_binding` set (there's nowhere to land the check); prompt user to bind first.

## Step 9: Epic Rollup Check

If the target nests under an epic:
- Read parent epic.md.
- Check sibling stages.
- If all siblings are `done` AND inline tasks are `[x]`, surface: *"Parent epic `{epic-slug}` may be ready to flip review → done. All children at [statuses]. Manual flip if confirmed."*

Don't auto-transition. User's call.

## Step 10: Report

> *"Review complete. {N} items passed ({M} with release binding: <version>, {S} skipped-with-note). {F} findings triaged — {P} parked to backlog, {X} fixed in-flight, {B} blocking (item back to [stage]). Parent epic: {rollup note or none}."*

## Anti-Patterns

- **Don't auto-fix findings without user approval.** Findings go through triage first. Only fix-in-flight items get resolved inline; others park or block.
- **Don't pass an item with un-verified fix-in-flight findings.** Anything the user could verify must be verified by the user before that finding counts as resolved (Step 6.5). Only internal-only fixes (refactors with no behavioral change, pure test additions, code-comment typos) resolve without loopback.
- **Don't hand-write scoped-as-new-work items.** Architectural-gap-surfaced and non-blocking-defer findings that become new active work go through `/scope` (Step 8 item 5). Hand-writing the item body risks wrong-stage (drafting on a story), wrong-handoff (/design on a story, which is an invalid transition), or inconsistent decomposition. `/scope` is the authority on kind sizing and pipeline entry points.
- **Don't present a checklist for the acceptance session.** Open-ended; user drives.
- **Don't skip pre-flight for code-based flow.** Stale migrations / unrestarted services produce repeated false findings.
- **Don't write changes before triage alignment.** All decisions are made interactively first.
- **Don't auto-bind items that didn't pass review.** Blocking findings prevent binding.
- **Don't skip the skip-with-note escape when it applies.** For items in classes user can't meaningfully review (security-tagged, deep technical convention), mark done with a note rather than blocking indefinitely waiting for a reviewer that doesn't exist yet.
- **Don't auto-transition the parent epic.** Surface readiness; user decides.
- **Don't park duplicates.** Dedup-scan before creating new backlog items.
