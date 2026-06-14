---
campaign: vidstack-layout-behavior
updated: 2026-06-14
---

# Acquisition candidates — vidstack-layout-behavior

Consolidated from specialist returns. F1 + F2 surfaced none (installed source was complete for
their facets). F3 surfaced enriching doc candidates whose content was behind JS-rendered code
blocks that `WebFetch` did not return — the installed CSS source filled each gap, so none are
blocking.

| Source | Class | Web-available | Urgency | Completes |
|---|---|---|---|---|
| Vidstack docs — DefaultVideoLayout CSS-variables reference (full list) `vidstack.io/docs/player/components/layouts/default-layout#css-variables` | tool-doc | likely (JS-rendered code block not returned by WebFetch) | enriching | A docs-authoritative var list; currently sourced from installed CSS (ground truth) |
| Vidstack docs — responsive-design full content (concrete sizing/embedding code examples) `vidstack.io/docs/player/styling/responsive-design` | tool-doc | likely (code blocks not returned) | enriching | A docs-blessed constrained-container recipe to corroborate the source-derived fix |
| Vidstack docs / release notes — `aspectRatio` prop CSS-mapping internals | tool-doc | possible (issue tracker / release notes) | enriching | Confirms the prop→inline-style mapping found empirically in the bridge JS |

Promotion into `.work/` (the `research-acquisition-queue` backlog item) is operator-confirmed —
not auto-written. All three are enriching (no claim is blocked); the installed source is
authoritative for the pinned version, so acquisition is optional polish.
