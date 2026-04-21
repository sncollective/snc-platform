---
tags: [streaming, community]
release_binding: null
updated: 2026-04-21
created: 2026-04-20
---

# Raids

Allow a creator to redirect their live viewers to another channel at stream end (or mid-stream). Natural fit for the TV model's multi-channel architecture — when one creator wraps, they can send their audience to another live creator or to an S/NC playout channel. Requires a raid API endpoint, viewer redirect notification in chat, and a cross-channel viewer migration flow.

## Before scoping — raid UX is a hard problem

Research flags raid UX as *"a hard design problem; a co-op platform needs a ready answer because cooperative-governance platforms are plausible political targets."* See [live-streaming-ux-patterns.md §3.6](../research/live-streaming-ux-patterns.md). Twitch's 2021 hate-raid wave shaped the entire defensive ecosystem (Shield Mode, raid-targeting restrictions, suspicious-user surfacing, phone/email verification, Sery_Bot-style third-party detection). Shipping raids without the defensive layer is a known footgun.

Specifically, the receive-side UX must integrate from day one:

- **Raid-target restrictions** — "raids from teammates / followed only" / "disable entirely" — configured per target channel, respected by the raid API.
- **Shield Mode equivalent** — one-click emergency that applies follower-only + sub-only + slow + phone/email verify + max AutoMod; pre-configurable templates; `/shield` command. Active during and after suspected hate raids.
- **Suspicious-user surfacing** — account age + prior timeout history inline in Mod View for raiding users.
- **Phone/email verification modes** — accounts sharing a verified number/email are ban-linked so a single ban covers coordinated sockpuppets.

The send-side UX is simpler (raid-out button, countdown, viewer migration) but has its own coordination problems — viewer consent, avoiding re-raiding the same target repeatedly, handling offline targets.

## Pattern references

See [live-streaming-ux-patterns.md](../research/live-streaming-ux-patterns.md) for the full raid/safety landscape:

- **§3.6 Raid & hate-raid defence** — load-bearing section. Covers raid-targeting restrictions, Shield Mode, phone/email verification, Sery_Bot-style detection, mass-ban-during-shield patterns.
- **§3.1 Channel modes** — the modes Shield Mode composes from (slow, follower-only, sub-only, verified).
- **§3.3 Manual moderator tools** — Mod View's suspicious-user surfacing sits here.
- **§3.10 Governance-aligned patterns** — transparency and reason codes apply equally to raid-triggered sanctions.

## Scoping notes

- Likely feature-sized. Needs a design pass that integrates send-side raid mechanics with receive-side defence from the start — shipping one without the other is the anti-pattern.
- Overlap: needs the Shield Mode primitive, which is its own multi-mode composition work. Consider scoping Shield Mode first as a standalone story, then raids on top.
- Cooperative-governance alignment: raid recipients should be able to opt out entirely (full-disable), not just tune. Incumbent platforms default-enable raids which creates the hate-raid attack surface in the first place.
