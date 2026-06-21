---
id: a11y-creator-streaming-surface
kind: feature
stage: review
tags: [streaming, creators, accessibility]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-20
updated: 2026-06-20
---

# A11y sweep: creator streaming manage surface

Consolidates five WCAG findings from the 2026-06-12 streaming/playout UX review, all on the
creator streaming manage page (`/creators/:id/manage/streaming`) and the shared
`SimulcastDestinationManager`. Batch shape (A): one feature, one task per finding. Two of the
findings (`connect-button-target-size` + `connect-button-missing-style`) share a single root
cause and a single fix.

Folds in (and replaces) the backlog items: `a11y-creator-connect-button-target-size`,
`bug-connect-button-missing-style`, `a11y-creator-revoke-button-focus`,
`a11y-creator-streaming-page-no-h1`, `a11y-creator-form-heading-hierarchy`.

## Tasks

- [x] **Connect buttons unstyled / fail target size (WCAG 2.5.8 + bug)** — `ConnectButton`
  passed `buttonStyles.secondaryButton`, but `.secondaryButton` did not exist in
  `button.module.css`; CSS Modules returned `undefined`, buttons rendered at 19px with no
  padding. Added a shared `.secondaryButton` class (matches the `error-page.module.css`
  secondary pattern; `--space-sm`/`--space-lg` padding clears the 24px minimum; carries
  `:hover`, `:focus-visible`, `:disabled`). **One fix closes both backlog items.**
  `apps/web/src/styles/button.module.css`.
- [x] **Revoke button has no focus indicator (WCAG 2.4.7)** — added `.revokeButton:focus-visible`
  (2px accent outline + offset + radius), mirroring the existing `.copyKeyButton:focus-visible`
  in the same file. `streaming.module.css`.
- [x] **Page has no H1 (WCAG 1.3.1)** — added a page-level `<h1>Streaming</h1>` (`.pageHeading`,
  `--font-size-2xl`); the three sections (Stream Keys / Connect / Simulcast) stay `<h2>` under
  it. Mirrors the `<h1>`-page-title precedent in sibling `join.tsx`. `streaming.tsx` +
  `streaming.module.css`.
- [x] **Simulcast form heading out of hierarchy (WCAG 1.3.1)** — the form rendered an `<h2>`
  inside an `<h2>` section. Used the finding's context-independent alternative: removed the
  `<h2>`, added `aria-label` to the `<form>`. **Decision below.**

## Decision: simulcast form heading — aria-label, not `<h2>→<h3>`

The finding's primary suggestion was `<h2>→<h3>`. Rejected because `SimulcastDestinationManager`
is shared across two surfaces with different surrounding heading levels:

- **creator streaming** — form sits under a section `<h2>`, so `<h3>` would be correct.
- **admin/simulcast** — form sits directly under the page `<h1>` (no intervening `<h2>`), so
  `<h3>` would *skip* a level (h1 → h3).

A single hardcoded heading level cannot be correct in both. The finding's offered alternative —
remove the heading, label the `<form>` via `aria-label` — is correct in both contexts and was
taken. The trigger-button text ("Add Destination") that the unit tests assert on is untouched.

*Revisit if* the manager ever needs a visible heading: thread a `headingLevel` prop from each
call site rather than reintroducing a hardcoded level.

## Verification

- Web unit suite green: 1760/1760 (162 files).
- `tsc --noEmit` clean on `@snc/web`; production build clean.
- No test changes needed — the simulcast tests assert the trigger *button*, not the removed
  heading.

## Fix-verify loopback (pending)

User-verifiable in the running app at `/creators/:id/manage/streaming`:

1. Connect Twitch / Connect YouTube buttons render as proper secondary buttons (border +
   padding, not bare 19px text).
2. Tab to a "Revoke" button — a visible focus ring appears.
3. Page announces a single H1 "Streaming"; section headings nest under it.
4. (Screen reader, optional) the Add/Edit Destination form announces its label without a
   duplicate-level heading.

Story stays at `stage: review` until confirmed. Provenance screenshots for the original
findings are under `.memory/scratchpad/streaming-playout-ux-review/`.

## Review pass (2026-06-20)

**Verdict: PASS-WITH-NITS → nits addressed.** All five findings verified correct: `.secondaryButton`
now resolves the `buttonStyles.secondaryButton` reference and clears the WCAG 2.5.8 target size;
exactly one H1 with clean h2/h3 nesting; the shared-component aria-label decision is sound (the
manager really is mounted under an `<h2>` on creator-streaming and directly under `<h1>` on
admin/simulcast, so no hardcoded heading level is correct in both).

- **Nit fixed:** added a regression guard for the original undefined-CSS-Modules-class bug class
  (`tests/unit/styles/button-module-contract.test.ts`). Vitest's default CSS-Modules handling
  returns the key string for *any* accessed property, so a render-based `className` assertion
  cannot catch a missing class — the guard instead statically asserts every `buttonStyles.X`
  reference in the streaming route resolves to a `.X` rule actually defined in `button.module.css`.
- **Note (no change):** the `.revokeButton:focus-visible` rule is technically redundant with the
  global `:focus-visible` outline in `global.css` (so WCAG 2.4.7 was likely not actually violated),
  but it is harmless and adds rounded ring corners. Left as-is.

## Review (2026-06-21)

**Verdict**: Approve (deep lane — cross-model adversarial convergence)

**Lane**: Deep. Phase 1 completeness pass (Opus host, inline). Phase 2 adversarial
pass via peeragent → codex (different model class), two rounds to convergence.

**Round 1 — codex found:**
- **Important**: the "exactly one H1" claim only held on the owner/admin render path; the
  non-owner branch returned a bare `<p>` with no heading, and the route loader admits
  non-owner members, so a non-owner navigating directly got a headingless page (WCAG 1.3.1).
- *Nit (acknowledged adequate)*: the button-class contract test is route-scoped, not
  repo-wide — adequate for this bug; broaden only if catching every `buttonStyles.*` typo.

**Fix (commit 4f311c9)**: added the page `<h1>Streaming</h1>` to the non-owner branch;
extended the streaming test to assert the level-1 heading for a non-owner (editor, non-admin).
Web 1767/1767, tsc clean.

**Round 2 — codex verdict: RESOLVED.** Non-owner branch now has exactly one H1; owner branch
H1 is mutually exclusive; no skipped levels, no duplicate H1, ContextShell adds none; the test
assertion is sound. No new issues.

**Blockers**: none
**Important**: none outstanding (round-1 finding fixed + re-confirmed resolved)
**Nits**: contract test is route-scoped (acknowledged adequate, non-blocking)
