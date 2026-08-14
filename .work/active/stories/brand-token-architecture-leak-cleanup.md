---
id: brand-token-architecture-leak-cleanup
kind: story
stage: implementing
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
