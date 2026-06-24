---
id: streaming-clip-moderation-dmca
kind: feature
tags: [streaming, community]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: stream-clipping-twitch-parity
created: 2026-06-24
updated: 2026-06-24
---

# Clip moderation + DMCA §512 safe harbor (viewer-UGC)

Viewer-created clips are user-generated content — this is the moderation + legal workstream around
them, distinct from clip creation itself.

Scope:
- **Post-moderation default** — clips publish immediately (pre-moderation kills the social-sharing
  value and is disproportionate at launch scale); a reactive member **report** (an ActivityStreams
  `Flag`-shaped action with a fixed reason enum) + creator removal authority.
- **DMCA safe harbor** — the statutory pieces sit in different subsections: **§512(c)** host safe
  harbor (registered designated agent + expeditious takedown on valid notice); **§512(g)**
  counter-notice / restoration; **§512(i)** repeat-infringer termination policy. Takedown records
  must distinguish the *source creator*, the *clipper*, and the *claimant* (they can differ).
- **Co-op governance layer** (the distinctive part) — moderation decisions affecting creators should
  be member-accountable: a published policy, an appeals path, transparency reporting — not black-box
  staff calls.
- **Not legal advice** — the §512 analysis is the research synthesis's read; legal counsel reviews
  before launch.

## Research grounding

**Source**: `.research/analysis/campaigns/stream-clipping-twitch-parity/parent.md` (slug: `stream-clipping-twitch-parity`)

The campaign's viewer-UGC moderation + DMCA surface; the §512 subsection precision and the
distinct-party records were sharpened in cross-model peer review.
