---
id: creator-press-page-scan-fast-follows
created: 2026-08-06
tags: [creators, content, ui, a11y, seo]
---

# Creator press page — scan fast-follows

Parked findings from the 0.4.0 targeted gate scan (a11y/seo/structural/quality) on
`creator-press-page`. The public-page a11y blocker (nested `<main>` landmarks) and
the no-image Twitter-card issue were fixed for ship (`02f6674`); these remain:

- **Press-photo alt text** — photos are stored as bare object keys; the page emits
  ordinal alt ("… press photo N") with no authored description. Model photos as
  `{ key, alt }`, render the authored alt, and expose `og:image:alt` /
  `twitter:image:alt`. (Schema + editor change; not triggered until photos ship.)
- **Release SEO** — the release page hardcodes `og:type="music.song"` (correct for
  the v1 single, but the model is format-agnostic) and emits no release-specific
  JSON-LD. Map known formats to `MusicRecording`/`MusicAlbum` or use a neutral OG
  type; add release structured data.
- **Manage editor a11y/complexity** — repeated "Remove" buttons lack context in
  their accessible names (add `aria-label` with link/photo/release identity + focus
  management); the editor carries ~20 `useState` cells (extract a typed reducer or
  section-owned state).
- **Canonical/OG URL hardening** — both routes fall back to `VITE_SITE_URL ?? ""`;
  verify the prod value is set, and prefer request-origin derivation over an empty
  default.
- **Nits** — add `decoding="async"` to the manage preview `<img>`; mark new
  object/prop boundaries `readonly` for consistency.
