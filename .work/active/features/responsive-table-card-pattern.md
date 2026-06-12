---
id: responsive-table-card-pattern
kind: feature
stage: drafting
tags: [design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Design-system: responsive table→card pattern

## Brief
UX-review cross-surface finding (2026-06-12): every management `<table>` fails reflow
at mobile — admin content-pool table (525px wide at 375px viewport, filed
`a11y-admin-pool-table-mobile-overflow`), admin simulcast table (filed
`a11y-admin-simulcast-table-mobile`), creator key rows borderline. Common root cause:
raw HTML tables with no responsive primitive. Define ONE shared pattern (card/list
layout at the mobile breakpoint, or scroll-wrapper with sticky first column — decide
once at design) as a design-system component/CSS pattern, then apply per surface.

Promoted from backlog to a standalone design-system feature at the
playout-admin-redesign epic design (user decision 2026-06-12): the primitive is built
here, on its own, rather than inside its first consumer. The
`playout-admin-redesign-responsive-structure` feature depends on this and is the
first adopter (pool table, simulcast table); creator surfaces adopt opportunistically
after. Note the existing seam: `SimulcastDestinationManager` already has a
`variant="table" | "list"` prop — the audit suggested the list variant as the mobile
rendering; the design pass should decide whether the shared pattern subsumes or
formalizes that.

## Epic context
- Parentless design-system feature — consumed cross-epic. First consumer:
  `playout-admin-redesign-responsive-structure` (declares the `depends_on` edge).
