---
id: story-content-detail-video-thumbnail-overlap
kind: story
stage: done
tags: [content, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-22
related_decisions: []
related_designs: []
parent: null
---

# Content Detail Video Thumbnail Overlap

On the content detail page in edit mode, the video thumbnail rendered at its intrinsic size and overflowed the sidebar/container. Added `max-width: 100%; height: auto` to `.coverArt` at [video-detail.module.css:73-77](platform/apps/web/src/components/content/video-detail.module.css#L73-L77).

Reviewed 2026-04-22 against a video content item in edit mode: thumbnail respects the container.
