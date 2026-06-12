---
id: a11y-creator-streaming-page-no-h1
kind: backlog
tags: [streaming, creators, accessibility]
created: 2026-06-12
---

# A11y: Creator streaming manage page has no H1 heading (WCAG 1.3.1)

## Violation

WCAG 2.2 SC 1.3.1 Info and Relationships — A

The creator streaming manage page (`/creators/:id/manage/streaming`) has no H1. The first heading is H2 "Stream Keys". The document outline presented to screen readers and assistive technologies has no page-level anchor.

## Context

The context shell sidebar shows "Maya Chen" and "Streaming" (the active nav item) but neither is marked up as a heading. The `<title>` element was not audited but the in-page heading structure starts at H2.

## File and line

`apps/web/src/routes/creators/$creatorId/manage/streaming.tsx:177` — first heading is `<h2 className={styles.heading}>Stream Keys</h2>`

## Severity

2 (minor) — affects screen reader navigation and document structure comprehension.

## Evidence

`.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c1-obs-initial.png`
