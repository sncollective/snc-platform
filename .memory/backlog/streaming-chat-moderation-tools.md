---
tags: [streaming, community, admin-console]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Live Chat Moderation Tools

Full moderation toolset for live chat: slow mode (configurable message rate limit per viewer), timeouts (temporary silence with configurable duration), bans (permanent removal from a channel's chat), and word filters (blocklist with pattern matching). Creators and designated moderators can action these from the chat panel or a moderation sidebar.

## Status 2026-04-21

Substantially covered by shipped `feature-chat-moderation` (0.3.0) — slow mode, timeouts, bans, word filters all live, server-enforced, with moderator UI via user-card popover. Check overlap before scoping anew; this item may be near-superseded or may want reframing around what's still missing.

## Reality-check what's left

What shipped in 0.3.0 covers the mechanics. Still open per live-streaming-ux-patterns.md:

- **Governance-aligned moderation patterns** (§3.10) — visible reasoned moderation with reason codes on every action, elected/term-limited moderators, community appeals committee, graduated enforcement (warning → timeout → ban), rules-acceptance gate on first chat, federated blocklists. None of these landed in 0.3.0; each is a substantial scoping pass in its own right.
- **Transparency & audit surfaces** (§3.8) — mod action logs visible to mods and (optionally) community, export, quarterly transparency reports. 0.3.0 has the append-only `chat_moderation_actions` table but no UI for reading it.
- **Viewer-side safety** (§3.5) — block user, report user, mute words (client-side filter), whisper opt-out. Not addressed in 0.3.0.
- **Raid defence** (§3.6) — Shield Mode equivalent, suspicious-user surfacing, phone/email verification modes, rules-acceptance gate. Tracked separately at [streaming-raids.md](streaming-raids.md).
- **AutoMod-equivalent** (§3.2) — category-scored hold-for-review with sender-visible status. Not in scope of 0.3.0.

## Pattern references

See [live-streaming-ux-patterns.md](../research/live-streaming-ux-patterns.md) for the full moderation UX landscape. Directly relevant sections:

- **§3.1 Channel modes** — slow / follower-only / sub-only / emote-only / verified / rules-acceptance. Platform modes are a tier above individual actions.
- **§3.2 AutoMod-equivalents** — Twitch severity sliders, YouTube hold-for-review, Kick strictness; transparency-to-sender is the recurring failure mode.
- **§3.3 Manual moderator tools** — timeout presets, ban/unban, delete, purge, Shield Mode, Mod View, user-card shortcuts.
- **§3.4 Roles & permissions** — broadcaster / mod / VIP / editor / subscriber / viewer; open design space for elected/term-limited mod roles.
- **§3.5 Viewer-side safety** — block, report, mute words, whisper opt-out, timeout/ban UX to the affected user.
- **§3.8 Transparency & auditability** — audit logs, export, appeals, transparency reports.
- **§3.10 Governance-aligned patterns for a cooperative platform** — the load-bearing section for a co-op's moderation posture.
