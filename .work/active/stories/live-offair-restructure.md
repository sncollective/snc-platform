---
id: live-offair-restructure
kind: story
stage: implementing
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

- [ ] State machine: channel "Scheduled" while player chrome says LIVE + chat
      "Reconnecting…" — one authoritative state. Off-air = OFF-AIR chrome (no LIVE badge,
      no live-chat reconnect messaging; chat panel reflects scheduled state).
- [ ] Arbitrary test-video slate → designed standby slate from TV voice tokens (cyan +
      parent spine); "Off air. Next: [title] — [day] [time]." + **Remind me** door (brief).
- [ ] Mobile: channel selector row clips Scheduled status — stack/wrap.

## Structural design (provisional values)

- [ ] Off-air info region gets purposeful composition (audit: near-blank viewport before
      footer) — next-program block, channel identity, remind CTA as the standby moment.
- [ ] The off-air surface is the TV-voice exception in the brief: grammar MAY speak here.

## Acceptance

- Single authoritative state in all player/chat/channel surfaces when off-air.
- Designed slate + next-program + one door, both modes, desktop + mobile.
- No clipped controls at 390px; screen-audit focused pass verifies.

## Operator note (2026-08-15)

- Continue structural work now. Follow-up logged: BOTH on-air and off-air /live need a
  proper UI/UX mockup pass eventually (player + chat + channel identity coexisting);
  that exploration returns to the operator for picks before shipping.
