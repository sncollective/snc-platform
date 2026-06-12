---
id: creator-stream-key-copy-button
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

# Add one-click copy to the stream-key reveal banner

UX-review finding (creator audit C1, severity 2): the new-key banner shows the raw key
with `user-select: all` but no copy button — creators must manually select-and-copy the
credential they're about to paste into OBS. Add a copy-to-clipboard button (with
copied-state feedback) to the key banner in
`apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`. Evidence and full
finding in the `streaming-playout-ux-review-creator-audit` story body.

## Acceptance
- [ ] Copy button on the new-key banner copies the full key; visible "copied" feedback
- [ ] Keyboard-accessible with visible focus state
- [ ] Unit test for the copy interaction (clipboard mocked)
