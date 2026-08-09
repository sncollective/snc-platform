---
id: creator-profile-brand-color
kind: feature
stage: drafting
tags: [creators, content, schema]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-09
updated: 2026-08-09
---

# Creator profile — brand color (site-wide reusable foundation)

## Brief
Add a creator-pickable **brand accent color** to the creator profile, reusable
across surfaces. The press-page-v2 **PDF Creator Brand Accent scheme** + future
surfaces (web press page, creator page) consume it. This feature delivers the
profile field + the setter logic/endpoint; the **editor** (`creator-press-page-v2-editor`)
delivers the picker UI (it's where creators set it).

## Scope
- `creatorProfiles.brandColor` — a nullable field storing the creator's chosen
  accent. **Curated palette for v1** (a small set of tasteful, contrast-safe
  colors against the dark surfaces — NOT arbitrary hex; free-hex-with-guardrails
  is a later option). Validate on write.
- An owner-scoped **update endpoint** (set/clear brandColor), or fold into the
  existing profile-update path. The editor's Appearance-and-media tab calls it.
- Consumers read `creatorProfiles.brandColor`; null = no accent (fall back to the
  platform default). The PDF Creator Accent scheme uses it (see
  `creator-press-page-v2-pdf`).

## Acceptance
- [ ] `creatorProfiles.brandColor` added (nullable; curated-palette-validated) via a generated migration.
- [ ] Owner can set/clear it; non-owner cannot.
- [ ] A consumer (the PDF scheme, as the first) reads it; null → default fallback.

## Notes
- The adversarial editor review flagged **contrast safety** (some presets fail 4.5:1 on `#1a1a2e`) — the curated palette must be contrast-safe, and consumers derive an accessible foreground (or constrain where the accent is used).
- This is the foundation the editor + PDF depend on; land it first.
