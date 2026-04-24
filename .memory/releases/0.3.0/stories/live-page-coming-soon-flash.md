---
id: story-live-page-coming-soon-flash
kind: story
stage: done
tags: [streaming, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-22
related_decisions: []
related_designs: []
parent: null
---

# Live Page Coming Soon Flash

On `/live` hard refresh the Coming Soon placeholder flashed for ~1s before the default channel loaded. The original fix (`!isStreaming && !isLoading` gate) didn't catch the case because `isStreaming` is derived from `selectedChannel`, which is null on first render — the default-channel auto-select effect doesn't run until after paint, so at least one frame paints with Coming Soon even when SSR already hydrated a non-empty channel list.

Gate rewritten to `!hasChannels && !isLoading` at [live.tsx:269](platform/apps/web/src/routes/live.tsx#L269) — Coming Soon now means "no active channels at all," matching the truth SSR hands over immediately. Works whether `selectedChannelId` has been set yet or not.

Reviewed 2026-04-22 against a fresh hard refresh with SNC TV in the channel list: no flash.
