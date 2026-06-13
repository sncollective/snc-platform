---
id: email-capture-at-shows-creator-qr-settings
kind: story
stage: implementing
tags: [community]
release_binding: null
depends_on: [email-capture-at-shows-join-api]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: email-capture-at-shows
---

# Band QR + join-page settings (creator manage)

Unit 5 of the parent feature design (`email-capture-at-shows`).

## Scope

New "Join page" section in the creator-manage shell:
`apps/web/src/routes/creators/$creatorId/manage/join.tsx` + module css.

- Join URL display (`/join/<handle ?? id>`) + copy button.
- QR preview rendered client-side with the `qrcode` npm package (**SVG**, new dependency
  in `@snc/web`).
- Print view via print stylesheet — full-page QR + band name + incentive line, legible at
  poster size.
- Config form (incentive text, S/NC explainer toggle, subscribe-CTA toggle) bound to
  `GET/PATCH /api/creators/:creatorId/join-config`.

## Acceptance criteria

- [ ] QR encodes the public join URL
- [ ] Print view legible at poster size (SVG, not canvas)
- [ ] Config edits round-trip; defaults shown before first save
- [ ] Section only visible to creator members
- [ ] Component tests per project convention
