---
tags: [streaming, calendar]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Premieres

Scheduled VOD playback with live chat — a creator schedules a previously recorded video to "premiere" at a specific time, appearing as a live event to viewers who can watch together and chat in real time. The playout system enables this natively: a playout channel can be configured to play a single video at a scheduled time. Depends on the programming schedule / EPG work for the scheduling layer.

## Pattern references

See [live-streaming-ux-patterns.md §1.5 Overlay & pre-roll states](../research/live-streaming-ux-patterns.md) for YouTube Premiere's shape:

- **Countdown timer** — centered on player; 2-minute default, customizable 1–3 min for channels over 1000 subs.
- **Chat is live during countdown** — viewers can chat before the video starts; creator often joins to greet arrivals.
- **"Set Reminder" button** below countdown — pre-premiere notification for users who open the page early and leave.
- **Static image or theme background** during countdown. Post-premiere: plays through as a normal VOD would.

Also relevant: [§1.4 Live-specific affordances](../research/live-streaming-ux-patterns.md) — scheduled-stream pattern where the LIVE badge may switch to a "SCHEDULED" or "UPCOMING" state before start time.

## Scoping notes

- The "is this actually live?" question matters for chat semantics. If a premiere is technically a scheduled playout with real-time chat, it's live-enough — reuse the live chat infrastructure.
- Research flags no co-op-specific concerns with this pattern.
- Natural dependency: requires `streaming-programming-epg` (EPG/schedule work) to be in place for scheduling; otherwise manual-trigger fallback.
