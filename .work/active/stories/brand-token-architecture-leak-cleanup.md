---
id: brand-token-architecture-leak-cleanup
kind: story
stage: done
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-route-scoping-contract]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — eliminate ad-hoc color leaks

## Brief

Classify all 133 audited color expressions / 338 occurrences (per
`brand-token-architecture` → `## Design — Mapping table` + the categorization artifact) and
eliminate non-exempt raw leaks across every syntax. Retire `--color-secondary`; apply the
settled status and fixed-preview mappings; centralize badge/status contrast using semantic
ink on the reference's opaque paired backgrounds. Public emissions/revenue remain
org-constrained through the explicitly temporary, lint-exempt `--legacy-public-chart-*`
bridge owned by this feature and expiring on org palette delivery.

## Acceptance

- **Inventory + enforcement:** all 133 expressions are dispositioned; the static no-leak
  grammar covers hex, rgb(a), hsl(a), named colors, and modern color functions. Outside the
  explicit allowlists, zero raw colors remain; `transparent`/`currentColor` are classified
  semantic keywords rather than silently skipped.
- **Semantic migration:** `--color-secondary` is retired everywhere except the temporary
  public-chart bridge's carried values. Selection/calendar/decoration consumers reach their
  state/data/identity roles; archived/inactive are neutral, pending/needs-grant warning,
  denied/failed error.
- **Fixed/orthogonal contracts:** manage-press fixed light/dark samples use
  `--preview-light-paper/ink` and `--preview-dark-paper/ink`; illustration and creator-brand
  values use their declared token homes rather than mode-aware spine shortcuts.
- **Contrast recipe:** text-bearing statuses use semantic ink on the republished opaque
  paired backgrounds; badge/status WCAG checks cover bg and elevated hosts in both modes,
  including base + hover + disabled + tint-composite cases.
- **Public-chart dependency:** chart consumers use only the lint-exempt
  `--legacy-public-chart-*` bridge, annotated with owner `brand-token-architecture` and expiry
  “org public-chart palette delivery”; they are not mapped to internal data colors. This
  checkpoint may pass with the bridge, but `alias-migration` may not.

## Implementation notes

- Execution capability: `gpt-5.6-sol` (caller-selected for the broad, mapping-sensitive CSS
  migration).
- Review weight: `standard` (caller).
- Disposition: migrated the audited authored-CSS surface to semantic roles and reduced the
  static checker result to zero outside token-definition files. Removed all 67
  `--color-secondary`/`-bg`/`-subtle` references and declarations; split consumers across
  badge-audio, info, success, route accent, shared state, and internal data roles. Raw
  `color-mix()` derivations now live only in token owners.
- Files changed: 77 authored CSS/token files plus
  `apps/web/tests/unit/styles/color-leaks.test.ts` and
  `apps/web/tests/unit/styles/token-contrast.test.ts`.
- Tests added/extended: added an all-syntax CSS leak checker (hex, rgb(a), hsl(a), named
  pigments, and modern color functions), with explicit `transparent`/`currentColor`
  classification; extended the contrast matrix for status pairs and content-badge tint
  composites over background/elevated and hovered hosts in light/dark modes, retaining the
  disabled visibility case.
- Checker mechanism: a Vitest static test, because the repo has no Stylelint setup and this
  boundary forbids package/lockfile changes. It runs automatically in `@snc/web test`, avoids
  a new dependency, and reports path/line/syntax for every violation. Token-definition files
  are the sole CSS path allowlist; the public-chart exception remains visibly owner/expiry
  annotated in `color/data.css`.
- Public chart bridge: added fixed pre-migration emissions/revenue series aliases in
  `color/data.css`; both public chart modules consume only `--legacy-public-chart-*` for
  their series colors and never consume the internal `--color-data-*` palette.
- Fixed/orthogonal contracts: manage-press fixed samples consume `--preview-*`, illustrations
  consume `--color-illustration-*`, creator-authored preview ink consumes
  `--color-on-creator-brand`, and media/overlay/shadow literals consume their named homes.
- Simplification: collapsed duplicate hover aliases at migrated call sites to
  `--color-hover-bg`, moved focus rings to `--color-focus`, retired the hero-gradient step,
  and replaced component-local status/color derivations with paired semantic backgrounds.
- Deviations from design: the two non-CSS inline literals named below remain because the
  delegated write boundary expressly excludes TSX. No mapping substitution was improvised.
- Adjacent issues parked: none; the remaining gap is an acceptance blocker recorded below,
  not optional follow-up work.
- Verification: `bun run --filter @snc/web test` (192 files / 1,982 tests), focused no-leak
  test (4/4), and `bun run --filter @snc/web build` all pass.

## Implementation discovery

**Orchestrator resolution (2026-08-14): both TSX literals migrated — story closes done.**
The TSX boundary was an over-narrow delegation (the audit grammar covers CSS + TSX inline
styles), not a design flaw: `privacy.tsx:31` `#666` and `platform-icon.tsx:37` `#888888`
(the generic globe — not vendor-exempt) both became `var(--color-text-muted)` per the mapping
table, applied by the orchestrator inside the item's scope. Full suite green post-fix
(1982/1982); the checker's authored-CSS face remains zero-violation. The TSX inline-style
face of the grammar is folded into `alias-migration`'s all-syntax no-leak acceptance
(this story's acceptance grammar is satisfied by the CSS face + the two migrated literals
being gone).

The broader 133-expression evidence includes two raw TSX literals that are not sanctioned
exceptions: `apps/web/src/routes/privacy.tsx:31` (`#666`) and
`apps/web/src/components/social-links/platform-icon.tsx:37` (`#888888`). Both map to
`--color-text-muted`, but this delegation permits writes only to CSS, token role files, tests,
and this story. The CSS checker is therefore honestly zero for authored CSS but cannot prove
“all 133 expressions” across the broader CSS+TSX audit. Completion requires authorizing those
two TSX substitutions (to `var(--color-text-muted)`) and either extending the checker with a
CSS-in-TSX face or explicitly narrowing the acceptance grammar to authored CSS. Stage remains
`implementing`; every permitted migration and required verification is otherwise complete.
