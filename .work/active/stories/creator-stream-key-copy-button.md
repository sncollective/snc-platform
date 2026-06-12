---
id: creator-stream-key-copy-button
kind: story
stage: review
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
- [x] Copy button on the new-key banner copies the full key; visible "copied" feedback
- [x] Keyboard-accessible with visible focus state
- [x] Unit test for the copy interaction (clipboard mocked)

## Implementation notes

**Changed files:**

- `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`:
  - Added `keyCopied` state (boolean, initialized false).
  - Added `handleCopyKey()` — follows `feed-url-card.tsx:40-49` clipboard pattern: `navigator.clipboard.writeText(rawKey)` → `setKeyCopied(true)` → `setTimeout(reset, 2000)`.
  - Reset `keyCopied` at the top of `handleCreate` so a newly created key starts uncoped.
  - Banner restructured: `newlyCreatedKey` block now wraps the `<code>` and `<button>` in a `.newKeyRow` flex div; button has `aria-label="Copy stream key to clipboard"` and shows "Copy" / "Copied!" based on state.
- `apps/web/src/routes/creators/$creatorId/manage/streaming.module.css`:
  - Added `.newKeyRow` (flex row, `align-items: flex-start`, gap).
  - `.newKeyValue` changed to `flex: 1` (fills remaining space in the row); `margin-bottom` moved to the row.
  - Added `.copyKeyButton` with hover state and `:focus-visible` ring (`outline: 2px solid var(--color-accent); outline-offset: 2px`) matching the convention in `fediverse-address.module.css:50`.
- `apps/web/tests/unit/routes/creators/manage/streaming.test.tsx`:
  - Added `"copies stream key to clipboard when copy button is clicked"` test: mocks `navigator.clipboard.writeText` via `Object.assign`, creates a key via the form, clicks the copy button, asserts `writeText` called with the raw key, and asserts "Copied!" feedback appears.

Scope: the copy button copies the raw key value only. The RTMP URL line is out of scope per the story.
