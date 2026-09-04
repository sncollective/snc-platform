---
id: press-row-sections-and-member-aspect
kind: story
stage: done
tags: [press, design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-03
updated: 2026-09-03
---

# Row sections equalized + 4:6 member feasibility (verified, not landed)

- FOR FANS OF and LIVE DATES equalized at identical 36px bounded sections
  (centered content, 2px high bias) per operator direction.
- 4:6 member aspect TESTED and verified feasible within the pinned compact
  budget (60x90 CSS windows, 188x282 spec, +30px over two rows): renders 200,
  crowns intact, page balanced-but-denser. REVERTED to 4:5 per operator
  preference ("speculative, I like the 4:5") — the 4:6 path is: figure
  min-height:90px + spec height 282. Documented for when the band picks a
  4:6 shot.
