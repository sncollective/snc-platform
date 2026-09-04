---
id: press-animalfuture-qr-destination-hardcode
kind: story
stage: backlog
tags: [press, cleanup]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Remove the animalfuture QR-destination hardcode once socialLinks carry the linktree

`defaultDestinationUrl` in `apps/api/src/services/press-pdf.ts` special-cases
`creator.handle === "animalfuture"` → `https://linktr.ee/animalfutureofficial`.
A per-creator hardcode sits in generic platform code; it went live in shipped
press artifacts for the first time with the creator one-sheet fix (2026-09-02,
cycle-2 EPK/one-sheet set) — campaign confirmed it renders as intended, so no
urgency.

Clean shape: seed the animalfuture creator profile's `socialLinks` with the
linktree (the resolver already prefers a linktr.ee entry in socialLinks over
the hardcode), drop the special case, and keep the unit test asserting the
seeded profile resolves the same destination. Zero behavioral change to
shipped artifacts; removes a creator name from platform code.
