---
tags: [streaming, ux-polish]
release_binding: null
created: 2026-04-20
---

# Live page player hover controls escape player at narrow width

At certain viewport widths on `/live`, player hover/overlay controls render *outside* the player's bounding box — specifically, controls that should sit on the top edge of the video end up floating into the adjacent chat panel's header area.

Observed 2026-04-20: with the video on the left column and chat on the right, the player's expand / exit-PiP arrow (`→`) rendered at the top-left of the chat panel rather than on the video frame itself. The player's in-frame controls (gear, mute, play/pause, fullscreen, LIVE badge, channel label) were in their correct positions — only the hover-overlay controls broke out of containment.

Related to the `global-player` layout issue also observed this session (see [global-player-live-stream-layout-issues.md](global-player-live-stream-layout-issues.md)) — may share a root cause around player chrome positioning not being clipped to the player container at some breakpoints.

## Likely shape

- Layout uses `position: absolute` on player hover-controls without a `position: relative` ancestor clipping to the player element at the breakpoint in question.
- Or a flex/grid container that was sized correctly at wider widths collapses and lets children overflow.

## Verification when picked up

- [ ] Resize `/live` across the 768px / 1024px / 1280px breakpoints — hover controls stay inside the player box at every width
- [ ] Same check on the global player (PiP / mini mode) — see sibling backlog item
- [ ] Both live and playout channel sources exercised
