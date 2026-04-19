---
tags: [admin-console, streaming, ux-polish]
release_binding: null
created: 2026-04-18
---

# Playout admin UI — Now Playing / Queue flicker + stuck timer

Observed on http://localhost:3082 admin playout (channel tab, S/NC Music) after the `streaming-callback-rate-limit` fix landed and content was actually streaming. Backend orchestration is sound — only 7 track-events fired in ~2000 log lines, auto-fill batches of 10 reconcile with queue positions advancing to 80+. The issues are frontend-only:

- **Now Playing / Queue panels flicker**: entries briefly disappear and reappear during what should be smooth track advancement. Likely a React Query / polling race where a brief refetch shows empty state before re-populating. The backend state is correct throughout — it's a render-layer issue.
- **Now Playing timer stuck at track duration**: e.g. "Morning Cascade 00:22" where 00:22 is the track's total length. Never ticks down as playback proceeds. Likely the display is showing `duration` rather than `duration - elapsed`, or the elapsed field isn't being updated via polling.

Scope: investigate the admin playout component's polling / TanStack Query config + how `getChannelQueueStatus` response is rendered. Files likely: `platform/apps/web/src/routes/admin/playout.tsx` and whatever queue-status hook it uses.

Discovery: 2026-04-18 during `/review` of `streaming-callback-rate-limit`.
