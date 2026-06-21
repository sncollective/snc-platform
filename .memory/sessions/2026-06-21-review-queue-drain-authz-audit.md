---
date: 2026-06-21
tags: [accessibility, calendar, creators, identity, streaming, workflow]
session_type: review-queue drain (6 items closed) + authorization-model audit + cross-model review loop
related_items:
  - calendar-task-checkbox-bug
  - calendar-event-patch-drops-visibility
  - content-media-stream-cache-control-stale
  - a11y-viewer-chat-input-focus-ring
  - a11y-admin-playout-console
  - a11y-creator-streaming-surface
  - authz-finish-creator-permission-migration
  - creator-public-page-manage-button-org-role-gate
  - timeline-checkbox-no-live-update
  - a11y-listbox-picker-focus-return
---

# Session: review-queue drain + authorization audit + cross-model review

Picked up the 6 items the prior session (2026-06-20 backlog drain) left at `stage: review`.
Reviewed all, fix-verified in the running app, audited the authorization model on a side
question, and drained the entire review queue. All on `main`, local, **unpushed**.

## What shipped (commits on main)

- `fd7570d` **fix(auth): creator events gated per-creator, not org-wide** — removed the blanket
  `requireRole("stakeholder","admin")` from `creator-events.routes.ts`; per-creator
  `requireCreatorPermission` is now the sole authority. Gave the GET list handler its own
  permission check (it had relied *solely* on the blanket guard — removing it naively would have
  turned a 403 into a cross-creator data leak). Reworked the stale role-based GET test.
- `6c24094` **fix(a11y): review nits** — listbox `aria-label` via `useListboxNavigation`;
  button-class contract test guarding the undefined-CSS-Modules-class bug class.
- `e496da1` **docs(authz): authorization-model position + scoped migration item**.
- `a4b0ffd` **docs(work): fix-verify note + 2 bugs found verifying**.
- `7b23ce0` **review: 4 stories fast-lane → done** (archived as stubs).
- `4f311c9` **fix(a11y): codex review round 1** — tabpanel aria ref + non-owner H1.
- `7598e8a` / `d0bd024` **review: 2 a11y features deep-lane Approve → done** (archived as stubs).

## Learnings worth keeping

- **The review skill is runnable directly even when not surfaced as a slash-command.** The
  harness didn't expose `/agile-workflow:review` as an invocable Skill this session, and I
  initially (wrongly) declared review "user-only." A SKILL.md is just a procedure — read the body
  and execute it, exactly as AGENTS.md instructs non-Claude agents to do. I drove the fast lane
  (4 stories) and deep lane (2 features, incl. the peeragent→codex adversarial step) by hand. Do
  not assume "not in the skill list" means "can't run it."

- **Cross-model adversarial review caught two real WCAG defects that three prior checks missed.**
  My inline review, the green test suite, AND the user's manual in-app fix-verify all passed both
  a11y features — yet codex (deep-lane Phase 2, different model class via peeragent) found a real
  verified bug in *each*: admin-playout tabs set `aria-controls` to per-channel panel ids while
  only the selected panel renders (broken ARIA ref with 2+ channels); the creator-streaming H1
  existed only on the owner render path (non-owner branch was headingless). Both bugs lived on
  paths the human didn't exercise (2+ channels; non-owner). The convergence loop (round 1 find →
  fix `4f311c9` → round 2 confirm RESOLVED) is the mechanism that made this pay off. Lesson:
  human fix-verify covers the happy path you log in as; the adversarial peer covers the branches
  you don't.

- **Don't advance on a single-pass fix — converge.** User's call: fix codex's findings inline but
  hold both features at `review` until codex re-reviewed clean. Correct discipline; that's the
  peer-review loop working, not ceremony.

- **`archived_atop` is not the git tag here.** `git describe --tags` returns the stale `v0.1.0`
  (the only tag ever pushed — platform's "deployment is user-at-station, plugin does not tag on
  release" convention means tags aren't the release source of truth). The actual latest *released*
  version is `0.3.0` (releases 0.1–0.3 `stage: released`, 0.4.0 `planned`), matching all 46
  existing archived stubs. Verify release-summary stages, don't trust `git describe`, when
  stamping the immutable baseline.

- **The session's recurring theme: a half-finished authorization migration.** Today's auth fix,
  the audit it prompted, and TWO of the bugs found during fix-verify are all the same class — a
  surface still gating on org roles where it should gate on per-creator membership. The platform
  has been incrementally shedding coarse `requireRole` route gates onto fine-grained
  `requireCreatorPermission` since March; it isn't done.

## Authorization-model audit

A side question ("do roles/permissions need a redesign?") prompted a mapping of both systems via
parallel agents (org roles + creator-team permissions + git history). Conclusion: **the
two-system architecture is sound and kept** (standard org/repo model) — what it has is an
unfinished migration plus verified inconsistencies. Captured as a durable position at
`.research/analysis/positions/authorization-model.md` (current state, accreted-then-rationalized
history, seams, rejected alternatives, revisit conditions). Scoped the cleanup as
`authz-finish-creator-permission-migration` (carries the verified latent 403 in
`project.routes.ts:82` — same dual-gate bug class fixed in creator-events today — plus the
`manageStreaming` half-adoption).

## End state

- **Review queue: empty.** All 6 closed (4 stories + 2 features), archived as bodyless stubs.
- **New items filed:** `authz-finish-creator-permission-migration` (drafting feature);
  `creator-public-page-manage-button-org-role-gate`, `timeline-checkbox-no-live-update`,
  `a11y-listbox-picker-focus-return` (backlog bugs — first two found during fix-verify).
- **Dev data cleaned:** the temporary `pat@snc.demo` creator-membership + test task event used to
  exercise the non-stakeholder-member auth path were removed; DB restored.
- **All commits on `main`, local, unpushed.** Codex review transcripts retained at
  `.memory/scratchpad/review-2026-06-21/` (ephemeral; the verdicts are recorded in the feature
  bodies at `git_ref 7598e8a`).
