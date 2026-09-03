---
id: press-instagram-handles
kind: story
stage: done
tags: [press, creators]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-03
updated: 2026-09-03
---

# Instagram handles on the band EPK (operator-directed, mesh-authorized)

Two clickable handles on the vertical one-sheet:
- **Label IG** `@signaltonoise.co` — inline in the contact row beside the
  emails (`PRESS · BOOKING · IG`), a label constant next to PRESS_EMAIL.
- **Band IG** `@animalfuturemusic` — derived from the creator profile's
  socialLinks (`platform: "instagram"`, schema-first-class), rendered as a
  second muted line below the streaming destinations in the Listen section.

## Implementation notes
- Both are URI annotations in the PDF link dictionary (9 total now).
- Campaign mirrors the AF socialLinks entry in seed-press.ts (profile lane).
- Incidents en route, recorded: (1) adding the IG pair to the contact row
  tripped the pinned template's padding-floor check — the new meta-line
  anchor wasn't exempt because the exemption only covered absolute elements
  themselves, not their descendants; the check now walks ancestors, and the
  fit message names the culprit element. (2) An inner helper function inside
  the fit-check's page.evaluate callback broke at runtime with
  `__name is not defined` — tsx/esbuild's keepNames transform survives into
  the serialized page function; direct bun runs don't transform. Inline
  loops only inside page.evaluate callbacks. Second runtime-parity miss of
  the session (Bun.spawn was the first) — rule recorded: test under the
  actual runtime, and keep page.evaluate callbacks self-contained.
