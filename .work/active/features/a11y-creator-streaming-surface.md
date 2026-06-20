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
