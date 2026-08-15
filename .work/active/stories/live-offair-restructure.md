---
id: live-offair-restructure
kind: story
stage: done
tags: [streaming, design-system, ux-polish]
parent: visual-identity-exploration
depends_on: []
release_binding: null
gate_origin: audit findings (defect class per org ruling) + empty-state brief off-air class
created: 2026-08-15
updated: 2026-08-15
---

# /live off-air restructure (defects + structural standby design)

Org ruling: the state contradictions are PLATFORM DEFECTS (no brand dependency); the
structural/typographic off-air proceeds now on provisional values; art-directed
signal/standby motif rides org's imagery layer later.

## Defect fixes (no design dependency)

- [x] State machine: channel "Scheduled" while player chrome says LIVE + chat
      "Reconnecting…" — one authoritative state. Off-air = OFF-AIR chrome (no LIVE badge,
      no live-chat reconnect messaging; chat panel reflects scheduled state).
- [x] Arbitrary test-video slate → designed standby slate from TV voice tokens (cyan +
      parent spine); no schedule payload exists yet, so the slate uses a graceful
      "The next program will appear here when a schedule is available" line and the
      existing notify-when-live mechanism as the single reminder door.
- [x] Mobile: channel selector row clips Scheduled status — stack/wrap.

## Structural design (provisional values)

- [x] Off-air info region gets purposeful composition (audit: near-blank viewport before
      footer) — standby signal, channel identity, reminder form, and scheduled-chat state.
- [x] The off-air surface is the TV-voice exception in the brief: grammar MAY speak here.

## Acceptance

- Single authoritative state in all player/chat/channel surfaces when off-air.
- Designed slate + next-program + one door, both modes, desktop + mobile.
- No clipped controls at 390px; screen-audit focused pass verifies.

## Operator note (2026-08-15)

- Continue structural work now. Follow-up logged: BOTH on-air and off-air /live need a
  proper UI/UX mockup pass eventually (player + chat + channel identity coexisting);
  that exploration returns to the operator for picks before shipping.

## Implementation notes (resumed worker)

- Inherited the interrupted worker's uncommitted live route, CSS, and route tests.
- Finished the authoritative airing-state reconciliation: only `live-creator` mounts
  the global player; scheduled/offline channels use the standby surface, while scheduled
  chat reports its waiting state without reconnect messaging. Same-channel source
  changes clear stale player state before loading replacement metadata.
- Added the TV-token standby composition, responsive channel/status wrapping, and the
  existing `NotifyMeForm` as the available reminder door. No next-program title/time is
  fabricated because the channel payload has no upcoming-program fields.
- Verification: focused route suite 29/29; full web suite 2,057/2,057 across 197 files;
  web build passes (dependency `use client` warnings only). Restarted PM2 `web`; focused
  screen-audit captured `/live` in dark/light at 1280/390 with 4/4 captures. Final vision
  pass found no LIVE/reconnect chrome, no test video, no primary-content clipping, and a
  composed standby/info region. The fullPage mobile capture's fixed bottom bar overlaps
  the below-fold footer in the stitched artifact; this is not a primary live-surface
  clipping issue and was not changed under the story boundary.
