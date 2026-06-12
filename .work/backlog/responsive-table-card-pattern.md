---
id: responsive-table-card-pattern
kind: backlog
tags: [design-system]
created: 2026-06-12
---

# Design-system: responsive table→card pattern

UX-review cross-surface finding (2026-06-12): every management `<table>` fails reflow
at mobile — admin content-pool table (525px wide at 375px viewport, filed
`a11y-admin-pool-table-mobile-overflow`), admin simulcast table (filed
`a11y-admin-simulcast-table-mobile`), creator key rows borderline. Common root cause:
raw HTML tables with no responsive primitive. Define ONE shared pattern (card/list
layout at the mobile breakpoint, or scroll-wrapper with sticky first column — decide
once) as a design-system component/CSS pattern, then apply per surface. The
`playout-admin-redesign` epic is the first consumer — coordinate so it doesn't invent
a one-off.
