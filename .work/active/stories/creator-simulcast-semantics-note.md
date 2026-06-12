---
id: creator-simulcast-semantics-note
kind: story
stage: implementing
tags: [streaming, creators]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# State when simulcast changes take effect (creator surface)

UX-review finding (creator audit C3, severity 3, code-confirmed): creator simulcast
changes apply on the NEXT publish (`on_forward` fires at stream start), but the UI copy
("Destinations stay active across all your streams until you toggle them off") implies
immediacy. A creator editing destinations mid-stream believes the change is live.
Add explicit copy near the destination list: "Changes apply the next time you start
streaming." Scope: creator surface only — the admin side's semantics (immediate via
publisher kick) belong to the `playout-admin-redesign` epic.

## Acceptance
- [ ] Creator simulcast section states next-publish semantics where destinations are edited
- [ ] Copy reviewed against the actual `on_forward` behavior in code (cite file:line in notes)
