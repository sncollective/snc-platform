---
tags: [studio]
release_binding: null
created: 2026-04-20
---

# Studio Public Landing Page and Inquiry Form (Phase 1 MVP)

Public `/studio` route and inquiry form. No auth required.

- `/studio` route — public landing page
- Hero section with studio overview and photo gallery
- Services section — recording, podcast, practice space, venue hire with descriptions and rate ranges
- Equipment list section
- Public contact/inquiry form (name, email, service interest, message)
- DB table for inquiry submissions (`studio_inquiries`)
- API: `POST /api/studio/inquiries` (public), `GET /api/studio/inquiries` (stakeholder)
- Studio content (copy, photos, rate ranges) — needs input from co-op members
