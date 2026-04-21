---
updated: 2026-04-20
---

# Live Streaming UI/UX Patterns

**Status:** Draft
**Date:** 2026-04-20

Reference synthesis of live-streaming player, chat, reactions, emote, mention, and moderation UX patterns as implemented by Twitch, YouTube Live, Kick, Discord (for threading comparison), and Owncast. Intended to inform downstream scoping of the platform's viewer surface — player, chat, moderation — so it can eventually reach the polish of incumbents while making cooperative-governance-aligned tradeoffs explicit.

**Scope boundary.** This doc is about *patterns* and *behaviours* observed on external platforms, not about what SNC will build. It names candidate adoptions and known failure modes so scoping work can pick deliberately. Streaming-infrastructure choices (SRS, HLS/LL-HLS, DVR window, encoder latency modes) are covered in `streaming-infrastructure.md` and `irl-streaming.md`; chat bridge mechanics are in `simulcast-chat-bridge.md`. This doc picks up at the viewer-facing surface.

**Platforms referenced:**

- **Twitch** — the most mature pattern vocabulary; most detailed examples below.
- **YouTube Live** — a divergent vocabulary (reactions-as-bursts, Super Chat pinning by amount, flat chat).
- **Kick** — Twitch-shaped, with looser moderation defaults and a chat-rules-accept gate.
- **Discord** — referenced only for threading/reply comparison.
- **Owncast** — referenced as a self-host reference implementation with minimal viewer UI.

---

## 1. Player layout & modes

### 1.1 Desktop layout modes

| Mode | Trigger | What persists | Notes |
|---|---|---|---|
| **Default** | page load | — | Player left, chat sidebar right (~340px, 25–30% of width). Twitch/Kick convention. YouTube defaults to *player above, chat below* on desktop — a notable divergence that third-party extensions patch. |
| **Theater** | `t` key or button | toggle state (localStorage) | Player expanded to near-full-width, chat pane retained, page content below the fold. Dark background to reduce chrome glare. |
| **Fullscreen** | `f` key or button | session only | Chat hidden by default; controls fade after ~2.5s idle. |
| **Picture-in-Picture** | PiP icon or OS gesture | independent window | Floating window survives tab switch; audio detached from tab-mute. Native on Chrome/Safari/Edge/Firefox; automatic on iOS/Android when the app backgrounds. |
| **Mini-player / floating on scroll** | scroll past player | until dismissed | YouTube collapses the player into a bottom-right floating tile; user can resize or dismiss. Twitch does not auto-miniaturize on scroll — only explicit PiP. |
| **Multi-view / squad** | dedicated UI | session | Twitch Squad (up to 4 streams, one primary + three secondary; clicking a secondary promotes). YouTube and Kick have no native multi-view; MultiTwitch and similar are external. |

Fullscreen + theater keyboard shortcuts are so well-established (`f`, `t`, `m`, `c`, space) that breaking them would be a polish regression.

### 1.2 Mobile layout

- Chat hidden by default; opens as a bottom-sheet drawer (~60–75% screen height). Dismissed via drag-down or X.
- Fullscreen is device-orientation-driven; on iOS, chat is *only* visible when *not* fullscreen.
- Controls fade after ~2s touch-idle; tap toggles visibility. Double-tap left/right seeks ±10s (with a transient "−10s"/"+10s" label). Vertical swipes on left/right halves map to brightness/volume in native mobile apps; not standard in HTML5 players.

### 1.3 Control bar

Standard surface (left-to-right, desktop):

- **Play/Pause** (space, `k`) — clicking center of live stream does *not* pause; pause snaps back to live edge within ~1s (Twitch/YouTube). On VOD, center-click pauses.
- **Volume + Mute** (`m`). Mouse scroll over player adjusts volume (Twitch). Volume level persists per-device in localStorage.
- **Live edge jump** — only present when viewer has scrubbed back into DVR buffer; otherwise hidden. Clicking jumps straight to live.
- **Scrubber** — DVR-enabled streams show a playable range; live edge marker at the right. Seek release → playback within ~500ms.
- **Captions** (`c`) — cycles off → lang1 → lang2 → off. CC icon changes state colour.
- **Settings / gear** — hierarchical menu on YouTube (Quality > tiers, Speed > tiers), flat on Twitch. Mobile collapses after selection.
- **Quality selector** — presented as source/auto + resolution tiers. YouTube couples quality to latency tier (Normal allows 4K, Low caps 1080p, Ultra Low caps 720p).
- **Latency mode selector** — Twitch in *Settings > Advanced > Low Latency* (not in persistent UI). YouTube treats latency as an encoder-side choice, not viewer-side. Neither surfaces "this may cause buffering" inline with the toggle.
- **Stats for Nerds / Video Stats** — debug overlay: resolution, bitrate, dropped frames, buffer health, codec, latency to broadcaster. Right-click on YouTube; Settings > Advanced on Twitch.
- **Clip** (Twitch only) — 60s window (30s pre + 30s post from click time), modal with a scrubber to adjust within that window; creates a clip and returns a shareable URL. No in-player trim — trimming is post-creation in the Clips dashboard. YouTube, Kick, Owncast: no native equivalent.
- **Share** — modal with timestamp link, embed code, social share. On live, link defaults to current broadcast (not a VOD).
- **Theater** (`t`), **PiP**, **Fullscreen** (`f`) — anchored bottom-right, always in that order.

Control bar fade-out: opacity transition ~300–500ms, cubic-bezier(0.4, 0, 1, 1). Hover reset is immediate. Tooltips appear after ~500ms hover (prevents tooltip spam during rapid scanning). Touch targets: 40px desktop / 48px tablet / 56px mobile.

### 1.4 Live-specific affordances

- **LIVE badge** (top-left or top-right, red/accent). Clicks may open analytics/stats.
- **Viewer count** adjacent to LIVE. Updates every 1–5s from server.
- **Uptime** — Twitch shows stream duration near follow button; YouTube exposes it only via description/chatbot. Viewer-facing uptime is a small Twitch polish win.

### 1.5 Overlay & pre-roll states

- **Offline** — centered "Channel Offline" message over profile image or last-stream thumbnail; chat disabled.
- **Scheduled / waiting** — countdown timer (YouTube Premiere: 1–3 min default, configurable for 1000+ subs); chat is live during countdown; "Set Reminder" button below.
- **Buffering / reconnecting** — centered spinner + optional percentage; auto-retry with exponential backoff (5s, 10s, 20s, stop).
- **Error** — modal "Playback Error: [code]" with Reload; tailored copy for common cases (age-restricted, region-blocked, content removed).
- **Age-gate / mature** — full-screen confirmation modal on YouTube; lightweight banner + single-click accept on Twitch.
- **Subscribe/follow CTA overlay** — Twitch uses lightweight contextual prompts for non-subscribers; YouTube leaves this to external widgets.
- **End-of-stream** — player holds last frame with "Stream Ended" badge; related streams surface below; chat goes read-only; VOD appears on a delay (Twitch ~12–24h) or immediately (YouTube).

### 1.6 Interaction patterns

Keyboard shortcuts that are essentially-standardized across both Twitch and YouTube:

- `space` / `k` — play/pause
- `m` — mute
- `f` — fullscreen
- `c` — captions
- `j` / `l` — seek −10s / +10s (VOD)
- arrow keys — seek ±5s (VOD)
- `>` / `<` — playback speed up/down (VOD only)
- `t` — theater (Twitch)

### 1.7 Accessibility

- Captions: WebVTT or in-band CEA-608; bottom-center positioning with semi-transparent background. Twitch/YouTube expose font family, size (75–200%), colour, background colour + opacity, edge style (outline/drop-shadow/raised/depressed) via settings. Owncast-equivalent implementations are CSS-driven and customizable by broadcaster.
- Live transcripts: neither major platform exposes real-time transcripts in the viewer UI during broadcast. Post-stream transcripts appear within ~24h. Third-party CART providers can inject WebVTT mid-stream.
- Screen-reader labels: all major platforms use native `<button>` with `aria-label`; icon-only buttons carry label fallbacks; hidden controls removed from DOM rather than CSS-hidden.
- Focus management: fullscreen should trap focus; Escape returns focus to the prior element. Modal overlays (settings, share) focus their first interactive element.

### 1.8 Polish signals (player)

- Fade-out on the control bar uses opacity (not `display: none`), so keyboard/gesture interactions still reach the controls.
- Icon size/opacity hover shift (`1.0 → 1.05` scale or `0.8 → 1.0` opacity) without causing layout shift.
- Scrubber thumb drop-shadow + real-time preview tooltip during drag.
- Contrast: controls on dark overlay meet WCAG AA (4.5:1), active/focus state uses accent colour.

---

## 2. Chat

### 2.1 Message rendering

Standard message line (Twitch/Kick):

```
[badge(s)] username: message
```

- **Badges** (left of username) — moderator (green sword), VIP (pink diamond), subscriber (tier-specific, customizable 1mo → 10+yr), Bits-cheer (gradient by lifetime Bits), partner/staff/founder. Multiple badges stack in priority order.
- **Username colour** — auto-assigned per user, or custom. Chat renders contrast-safe against light/dark mode.
- **Timestamp** — hidden by default, shown on hover (Twitch). Tooltip should carry both absolute time and relative ("2m ago"). YouTube doesn't expose timestamps in the live feed at all.
- **Emotes inline** — rendered at ~20–30px height (2x/3x DPI variants available).
- **Mentions** — `@username` renders with a subtle background highlight (pale blue/yellow) and is click-to-open-user-card.
- **Links** — neither Twitch nor YouTube unfurls; appears as plain coloured text. Preview unfurling is client-or-extension territory.
- **Action messages** (`/me`) — rendered italic/coloured without the badge:username prefix, as `* username message`.
- **AutoMod-held messages** — invisible to other viewers; sender sees "Your message is being reviewed" state; resolves to "approved" / "denied".
- **System/event messages** — raid, follow, sub, gift-sub, hype-train each get distinct styling — usually a coloured callout box with iconography, not a plain username-prefixed line.
- **Line density** — compact, ~4–6px vertical spacing. Long lines wrap; emote chains wrap naturally. Twitch caps at 500 chars per message.
- **"New messages" indicator** — floating pill appears near the bottom of the pane when the user has scrolled up. Click to autoscroll to live.

### 2.2 Composer

Desktop composer (Twitch as the reference):

- **Emote picker** (smiley icon) — tabs: Channel / Favorites / Recent / (+ BTTV/7TV/FFZ if extensions installed); search input at top; category list below. Emote tiles are larger than inline render (~32–48px) for selection accuracy.
- **Mention autocomplete** — typing `@` opens a recent-chatters list; arrow keys + Enter/Tab selects. Filter-as-you-type. Selecting a user fires a notification/ping to them.
- **Slash commands** — `/me`, `/slow`, `/followers`, `/subscribers`, `/emoteonly`, `/ban`, `/timeout`, `/mod`, `/vip`, `/pin`, `/shield` etc. Docs list them; no autocomplete in-composer on native Twitch.
- **Rate-limit countdown** — in slow-mode, composer shows "You can send another message in Xs"; decrements live.
- **Character counter** — native Twitch has none; third-party extensions add one. Over-limit messages are rejected with an inline error.
- **Reply affordance** — on hover over a message, a reply icon appears; clicking opens the composer with the target message quoted above it (indented, coloured, username surfaced).
- **Paste** — multi-line paste sends each line as a separate message; no image/file paste support.
- **Draft persistence** — not implemented natively on Twitch (page reload loses draft); meaningful polish opportunity.

Mobile composer collapses the picker/commands behind a single overflow icon; the composer expands on focus to occupy more of the bottom sheet.

### 2.3 Replies & threading

Three distinct patterns:

- **Twitch reply threads** (2021+) — replies stay *inline* in the main chat stream, grouped visually (quoted original + reply indented/accent-bordered). User setting toggles between "Minimal" (reply-only) and "Expanded" (original + reply). No sidebar. Scales to high-volume chat reasonably well because nothing is hidden.
- **YouTube Live** — no threading; flat chat only.
- **Discord threads** — full sub-channel split-panel; threads are isolated from the main feed. 24h auto-archive. Good for sustained side-conversations, too heavy for ephemeral live-stream chat.

For live-stream pacing, Twitch's inline-grouped pattern is the strongest reference — keeps the conversation in one pane while still letting replies be addressable.

### 2.4 Emotes

Three simultaneous sources on Twitch in practice:

- **Platform emotes** — ~50–100 globals (Kappa, LUL, PogU); always available.
- **Channel emotes** — broadcaster-uploaded; tier-gated (Tier 1 / 2 / 3 subs); Affiliates have 5 slots, Partners 30+. Tier-3 emotes unusable by tier-1 subs, etc.
- **Third-party browser-extension overlays** — 7TV, BTTV, FrankerFaceZ. These inject additional sets into chat rendering *only* for users who have the extension installed; other viewers see text/noise.

Mechanics worth imitating:

- **Animated emotes** — GIF/WebP/MP4 at 1x/2x/3x scales. Non-animated fallback for reduced-motion.
- **Zero-width emotes** (7TV innovation) — consume no horizontal space, stack atop the preceding emote. Enables combos. BTTV's `w!`/`h!`/`v!`/`z!` prefix modifiers are analogous.
- **Emote hover preview** — large preview + emote name + source channel on hover in the picker or in chat itself; key discovery path.
- **Emote search** — required at ~5+ channel emotes; most effective when search includes 3rd-party sets.
- **Unlock UX** — 7TV's Cosmetics panel is the cleanest pattern: one modal showing all unlockable variants (personal emotes, name-tag paints, animated pfp). Twitch's per-tier model is more fragmented.

The key insight from the third-party ecosystem: an official platform emote layer that matches 7TV-style capability (animation + zero-width + personal emotes) effectively removes the need for browser-extension overlays — which is both polish (one consistent render for all viewers) and a moderation win (no extension bypass of filtering).

### 2.5 Reactions

Three distinct models:

- **Per-message emoji reactions** — Discord-style. Hover a message → react → count shown under the message; hover count shows which users. Good for asynchronous engagement; rarely used on high-volume live chat.
- **Channel-wide floating reaction burst** — YouTube's pattern. Viewer taps one of 5–6 preset emoji (heart, laugh, surprised, …); a big emoji floats up from the bottom of the player, visible to everyone for ~1–2s. Aggregate-only — individual reactions are anonymised.
- **Aggregate engagement trackers** — Twitch Hype Train and Channel Points. Not message-reactions per se; they're a meter that fills when subs/bits/redeems happen, triggering an overlay and a special system message when activated.

For live, the YouTube floating-burst pattern is the most useful low-friction primitive — engagement signal without crowding chat. Per-message reactions are worth adding for Q&A or clip-worthy moments.

### 2.6 Mentions & notifications

- **Autocomplete** — `@` opens recent-chatters; arrow nav + Enter selects. Essential polish.
- **Highlight styling** — mentioned user's line carries a background tint (the *receiver* sees themselves highlighted in their own chat view).
- **Mention filter tab** — Twitch native has none; Chatterino/Chatty third-party clients expose a "mentions only" filter. A native "mentions" tab in the chat panel is a meaningful polish win for high-volume chat.
- **Notification sounds/flashes** — OS-level browser notifications if enabled; no in-chat sound on native Twitch (third-party overlays add this).
- **DM vs. in-channel** — Twitch has whispers (channel-independent, can be opted out of for non-followers); YouTube has no chat DMs. Kick similar to Twitch.

### 2.7 Pinned & announcement messages

- **Pinned message** (Twitch) — broadcaster or mod pins a message via `/pin` or a message context action. Appears in a dedicated slot above the chat stream, collapsible per viewer. Duration is configurable (manual or timed up to 30min or unlimited).
- **Announcement** (Twitch) — a broadcaster-posted banner with a coloured gradient (blue/purple/pink/green), sits at the top of the stream as a channel-wide notice. Distinguished from pinned because it's styled, not filed.
- **Super Chat pinning** (YouTube) — paid messages pin by amount: $5 ≈ 2–5min, $50 ≈ 30min, $500 ≈ ~5h. Colour tier indicates amount. This is monetization-driven; on a co-op platform, pin duration should not be buyable — pin by *mod intent* only.

### 2.8 User cards

Click-username popover is the mod workhorse. Twitch surfaces:

- Avatar, display name, partner/staff badge
- Follow status / follow date / watch time in channel
- "Visit channel" link
- Mod quick-actions (if viewer is a mod): timeout presets (1m / 10m / 1h / 1d), ban, VIP, mod, message-history filter

This popover is the single highest-leverage polish surface in chat — a well-designed user card turns moderation from a command-typing task into a two-click flow.

### 2.9 First-time chatter & newcomer flow

- **First-time chatter highlight** (Twitch) — new chatters render with a subtle border/label for ~1 message, visible to mods/broadcaster only. Helps welcome and helps flag raid bots.
- **Chat Highlights** (Twitch 2022) — mods can toggle filters to show only first-time / mentions / mods / subs / VIPs. Important for high-volume streams.
- **Channel-mode gates** — when a follower-only/sub-only/verified mode blocks the user, the composer swaps to an explanatory state: "You must have followed for 10 minutes to chat" + follow CTA. The gate copy + CTA is the moment the platform has to be clear.
- **Welcome messages** — not a native platform feature anywhere; invariably bot-driven. Opportunity for a lightweight native primitive.

### 2.10 Polish signals (chat)

- **Autoscroll pauses on hover** — hovering the stream pauses autoscroll so the user can read; leaving resumes. Baseline expectation.
- **Emote hover preview in chat** — full-size preview + name + source on hover over any emote in a message (not just the picker).
- **Skeleton loading of history** — greyed message-shaped placeholders while history fetches; avoids layout shift.
- **Fade-in on new messages** — 0.2–0.5s opacity ramp; draws attention without flicker.
- **Virtualization at high throughput** — only viewport-visible messages in the DOM; critical at >50 msg/s.
- **Unread badge** (mobile) — count on the chat icon when user is away from the pane.
- **Pinned-message collapsible** — one-click collapse of pinned slot to reclaim vertical space.
- **Context menu on message** — copy text, copy emote, copy link, report, mod-shortcuts. Missing natively on Twitch; present in Chatterino.
- **Keyboard nav in all dropdowns** — emote picker and mention autocomplete must both support arrow + Enter/Tab. Regularly omitted.

---

## 3. Moderation & viewer safety

### 3.1 Channel modes

| Mode | What it does | How viewer sees it |
|---|---|---|
| **Slow mode** | per-user cooldown (5s–2min) | composer shows countdown: "Send another in Xs" |
| **Follower-only** | requires N minutes–3 months of follow | composer blocked with follow-duration gate + follow CTA |
| **Subscriber-only** | subs only | composer blocked with subscribe CTA (non-sub) |
| **Emote-only** | messages must be 100% emote | composer rejects text |
| **Unique-chat** | rejects duplicate messages | rejection message on resend |
| **Email/phone-verified** | verified accounts only | composer blocked with verify CTA |

Twitch offers all of the above; YouTube supports slow / subs-only / members-only / "approved chatters only"; Kick supports the common subset plus a **chat-rules acceptance gate** — a panel over the composer requiring the user to accept channel-specific rules before their first message. The rules-acceptance gate is a strong pattern for a cooperative platform: makes community norms visible *as a condition of participation*, not as an after-the-fact surprise.

### 3.2 AutoMod-equivalents

Comparative surface:

- **Twitch AutoMod** — four independent sliders (identity, sexual, aggression, profanity), each 0–4. Held messages land in the Mod View AutoMod queue as `[user] [message]` with Allow / Deny buttons; sender sees "Your message is being reviewed" → "approved" / "denied"; other viewers see nothing until approved.
- **YouTube** — single "hold potentially inappropriate" toggle; opaque category; rejections cite "Community Guidelines" generically. Mods work from a "Held for review" tab.
- **Kick** — configurable strictness 1–5 on spam/gibberish/repetition; narrower scope than Twitch.

Known failure modes to avoid:

- **Opacity to the sender** — if a message is held/denied and the sender doesn't know *why*, they cannot adjust. Twitch does this better than YouTube; neither does it well.
- **AAVE / reclaimed-language false positives** — identity filters flag these. Low-context ML models produce disparate-impact errors.
- **No confidence surfaced to the mod** — a mod reviewing an AutoMod queue gets a binary flag, not a "this message scored 78% aggression". Confidence exposure is an opportunity.
- **Denied messages have no appeal loop** — the sender cannot request clarification; the decision is final and invisible.
- **No cross-channel learning** — a user banned on 20 channels for coordinated harassment isn't flagged on the 21st. Intentional on commercial platforms (liability); an opt-in shared-blocklist mechanism is an alignment lever for a co-op.

### 3.3 Manual moderator tools

Common surface:

- **Timeout** — preset durations (1m / 10m / 1h / 1d on Twitch; 10s–24h dropdown on YouTube). Inline chat system message on Twitch; silent on YouTube.
- **Ban / unban** — permanent. Twitch announces inline; YouTube is silent. User's own composer shows "You are banned from this channel" on Twitch.
- **Delete message** — silent; other viewers see a "[message deleted]" stub (Twitch) or nothing (YouTube).
- **Purge** — delete last N seconds / all from a user. Useful during spam bursts.
- **Clear** — wipe all current chat (rare; blunt).
- **Shield Mode** (Twitch) — one-click emergency: follower-only + sub-only + slow + phone/email verify + max AutoMod + word mass-ban. Templates saveable; `/shield` activates. Used against coordinated hate raids. Downside: makes the channel cold to legitimate new viewers; streamers forget to deactivate.
- **User card mod shortcuts** — the primary flow for most mod actions (see §2.8).
- **Mod View** (Twitch) — a separate dashboard layout: AutoMod queue widget, active-mods list, users-in-chat panel, per-user timeout history + account age inline. Critical for channels big enough to have dedicated mods.

Inline vs. silent moderation is the core tradeoff. Inline (Twitch) sets user expectations + announces norms; silent (YouTube) protects the mod but leaves the community confused. A principled default is inline + reason code, with opt-out for threat cases.

### 3.4 Roles & permissions

Current incumbent roles:

- **Broadcaster** — channel owner; everything.
- **Moderator** — chat actions + mode toggles. Green badge.
- **VIP** (Twitch) — cosmetic/social; bypasses slow + sub-only + verified modes. *No* mod authority. Pink diamond. Max 10.
- **Editor** (Twitch) — off-stream content access (clips, schedule, panels). No chat rights.
- **Subscriber** — tier-badged. Unlocks emotes; access to sub-only features.

None of the incumbents have:

- Elected/term-limited moderators
- An explicit appeals-officer role separate from enforcement
- A "moderator review committee" role with propose-only authority
- Per-action permission granularity (e.g., a mod who can timeout but not ban)

These are open design space for a cooperative platform.

### 3.5 Viewer-side safety

- **Block user** — removes their messages from the viewer's chat and blocks whispers. User is not notified.
- **Report message / Report user** — opens platform Trust & Safety form; invisible to channel.
- **Muted words** — client-side filter on message text. Twitch native has none (third-party only); worth implementing natively.
- **Hide chat** — collapses the whole pane.
- **Whisper opt-out** — can disable DMs from non-followers.

Timeout/ban UX received by the affected user:

- Twitch: inline "You are timed out for X minutes" countdown in composer. Reason: absent unless mod included a memo. No channel-level appeal path — account-level suspensions appeal at appeals.twitch.tv, but channel bans have none.
- YouTube: composer silently stops working; email arrives ("You've been temporarily blocked from chatting"). Reason generic. Appeal via email link; response in days to weeks; no re-appeal if denied.
- Kick: mostly client-side mute; appeal is opaque.

The floor for a principled platform: the affected user always sees (a) the specific rule cited, (b) the duration, (c) the appeal path, (d) the deciding mod or the committee.

### 3.6 Raid & hate-raid defence

Twitch's ecosystem response (2021 hate-raid wave):

- **Raid targeting restrictions** — "raids from teammates/followed only" / disable entirely.
- **Shield Mode** — see §3.3.
- **Suspicious-user surfacing** — account age + prior timeout count inline in Mod View.
- **Phone/email verification modes** — one account's ban extends to accounts sharing the same number.
- **Third-party hate-raid detection** — Sery_Bot flags account-creation spikes and mass-times-out.

YouTube/Kick don't have explicit raid-targeting features. Raid UX generally is a hard design problem; a co-op platform needs a ready answer because cooperative-governance platforms are plausible political targets.

### 3.7 AI/ML-assisted moderation transparency

The opportunity area vs. incumbents:

- Expose **category + confidence** to both mod and sender ("aggression, 67%").
- Publish **quarterly AutoMod accuracy** by category, with appeal-overturn rate.
- Provide a **model-feedback loop** — users can flag AutoMod errors to improve training.
- Keep **human-in-the-loop on auto-punish** — no auto-timeout without review (all three incumbents do this).

### 3.8 Transparency & auditability

Current incumbent audit gaps:

- Twitch native audit log tracks only *currently-active* bans; expired bans vanish. Timeouts aren't logged at all. Searchable history is on the UserVoice roadmap for years.
- YouTube has no public mod action log. Banned users don't know who banned them.
- Kick logs mod actions with timestamps + attribution in the dashboard, but appeal transparency is still low.

A principled platform should ship with:

- Public (or mod-visible + affected-user-visible) audit log: action type, target, moderator, timestamp, reason code.
- Export-to-CSV for mod teams.
- Quarterly transparency report: total bans issued, appeals received, appeals granted, avg time-to-resolve.
- Visible moderator conduct standards and clear consequences for mod abuse.

### 3.9 Ecosystem mod tools

The Twitch third-party bot ecosystem (Nightbot, Fossabot, StreamElements, Sery_Bot) covers gaps in native tooling — welcome messages, regex filters, hate-raid detection, greeting automations. A native platform should:

- Provide first-class primitives for the most common bot use-cases (welcome messages, regex/substring filters, auto-moderator actions).
- Offer an open bot API/framework for community-hosted extensions, with published uptime SLA and rate limits.
- Audit third-party bot permission scopes visibly.

### 3.10 Governance-aligned patterns for a cooperative platform

Drawing from academic work on community-governed moderation (CHI 2023 on moderator conflict; IMX 2021 on volunteer moderator collaboration) and the Santa Clara Principles on Transparency and Accountability, the patterns that compose into a coherent co-op posture:

1. **Visible, reasoned moderation** — every enforcement action carries a reason code from a published taxonomy + optional free-text memo. Affected user always sees the reason. Community can see aggregate breakdowns.
2. **Elected/term-limited moderators** — streamer nominates; community confirms; fixed-term; reapply or rotate. Separates mod authority from streamer fiat.
3. **Community appeals layer** — first appeal to mod team, second to an elected appeals committee. 7-day SLA. Decisions cite specific rule + evidence.
4. **Graduated enforcement** — warning → timeout → ban. No shadow-bans; no silent deletions. Bans reviewed automatically at 30/90 days.
5. **Rules-acceptance gate on first chat** — Kick's pattern, upgraded with per-community rules.
6. **AutoMod transparency** — category + confidence visible to user and mod; appeal path; published accuracy reports.
7. **Federated moderation** — each instance sets its policy; blocklists can be shared across instances but are opt-in, not centralized; no unilateral cross-instance bans.
8. **Full audit + export** — mod teams can export their own logs; community can query aggregate data.

Not every one of these needs to ship at v1 — the intent is to make the *shape* of the opposition to incumbent patterns explicit, so scoping can pick which to build when.

---

## 4. Engagement overlays (monetization-adjacent)

Briefly, because these sit at the intersection of UX and commerce and are likely out of SNC's near-term scope — but worth naming so scoping knows the pattern vocabulary:

- **Polls** (Twitch/YouTube) — streamer-initiated; 2–5 options; viewer votes in a chat-anchored panel; live result bars.
- **Predictions** (Twitch) — viewers stake channel points on outcomes; payout on resolution. Likely not a co-op primitive.
- **Channel Points / redemptions** (Twitch) — per-channel currency; redemptions trigger chat messages or automated actions (sound, emote-only mode, etc.).
- **Super Chat / Super Stickers** (YouTube), **Bits/cheers** (Twitch) — paid messages/emotes. Monetization-pinned. If SNC offers paid support, the pinning-by-amount pattern is a known anti-pattern for co-op alignment; flat-pin-by-intent is more aligned.
- **Hype Train** (Twitch) — aggregate engagement meter (subs + bits); activates overlay + system message when filled.
- **Subs / gift subs** — recurring monthly support; gift subs produce system messages ("X gifted 5 subs"). The pattern of making support-events visible in chat reinforces community, regardless of commercial model.

---

## 5. Mobile & responsive

Key behavioural shifts vs. desktop:

- Chat hidden by default; bottom-sheet drawer; resizable handle.
- Fullscreen is orientation-driven; chat unavailable in fullscreen (iOS).
- Controls fade after 2s; tap toggles.
- Double-tap left/right = seek ±10s (VOD).
- Long-press for 2x playback (YouTube; not standard).
- Unread message badge on chat icon when away.
- Composer expands on focus; picker collapses into overflow.
- Mid-stream PiP on app background (Twitch, YouTube on supported OS versions).

Scrollable chat within a draggable bottom sheet is the main interaction sharp edge — handle needs to be unambiguous, drag thresholds tuned, and accidental composer dismissal avoided.

---

## 6. Accessibility (cross-cutting)

- Caption customization (font, size, colour, background, opacity, edge style) is table-stakes.
- Live captions during broadcast — not solved by any major platform; auto-generated via ASR is acceptable quality but not WCAG-conformant. Reduced-motion handling for animated emotes / floating reactions / Hype Train overlays is worth explicit support.
- Screen-reader labels on all controls; `aria-live="polite"` on chat messages (with throttling — high-volume chat read aloud is unusable without digest mode).
- Keyboard-only operability for all composer, picker, user-card, and mod-action flows. Twitch is inconsistent here; a greenfield implementation has a real opportunity.
- Colour contrast AA minimum on badges, mentions, mod highlights. Tier-badge colours should not be the sole channel for mod/VIP/sub distinction — icon + colour.

---

## 7. Polish signals, distilled

High-leverage small details that show up across both player and chat research:

- Control fade uses opacity, not display; hover/tap resets are immediate.
- Tooltips delay ~500ms; hover state is instant.
- Autoscroll pauses on mouse-over chat.
- Skeleton loaders during history fetch prevent layout shift.
- Emote hover previews everywhere an emote renders (picker + chat).
- User card click-open is the single most leveraged mod surface — invest there.
- Reply threading stays inline rather than splitting into side panels for live pacing.
- Live-edge snap-back on play/pause of a live stream (don't let viewers sit 30s behind).
- Keyboard parity: arrow + Enter/Tab in every dropdown; shortcut for every button.
- Reason codes on every mod action, shown to the affected user.
- Unread badge on chat icon on mobile; new-messages pill when scrolled up.
- Virtualized chat rendering above ~50 msg/s.

---

## Open questions for scoping

- **Emote system scope.** Build an emote layer that matches 7TV's capability (animation, zero-width, personal emotes) natively, or permit a third-party extension layer? Native is more polished and moderation-clean; third-party is cheaper to ship.
- **Reply model.** Adopt Twitch-style inline replies (low risk, known-good at live pace) or lean on Discord-style threading (heavier, better for sustained side conversations but likely wrong for live)?
- **Reactions.** Per-message emoji reactions, YouTube-style floating-burst, or both? The floating-burst is the higher-leverage low-friction primitive; per-message is Q&A / clip-moment territory.
- **Monetization-pinned messages.** Accept the Super Chat pin-by-amount pattern, or hold pinning to mod intent only? The latter is more aligned with cooperative values but loses a monetization lever.
- **Mod transparency defaults.** Inline moderation announcements (Twitch) or silent (YouTube) as default? Inline + reason codes is proposed here but the choice has security tradeoffs in threat contexts.
- **Appeals architecture.** Streamer-only, mod-team, or elected community committee as the appeals authority? Ships orthogonal to rest of moderation but shapes everything else.
- **First-chatter welcome.** Native welcome-message primitive, or defer to community-run bots?
- **Raid model.** Do we support cross-channel raids at all, and if so, with what anti-raid controls baked in from day one?

## Revisit if

- A live streaming SKILL or design reference lands in `.claude/skills/` — this doc's content may want to collapse into it.
- The platform commits to a specific player/chat framework that constrains which patterns are cheap vs. expensive — at that point, convert recommendations into decisions.
- A scoping pass produces features that touch this surface — cite this doc as input, note any patterns that were reconsidered, and update sections in place rather than appending.
- External pattern vocabulary shifts significantly — e.g., a new incumbent player emerges, or Twitch retires Shield Mode for something else.

## Sources

Primary platform documentation:

- Twitch: `help.twitch.tv` — AutoMod, chat badges, first-time chatter highlight, Mod View, Shield Mode; `safety.twitch.tv` — appeals, chat tools, combating targeted attacks, phone/email verification; `dev.twitch.tv` — chat moderation API, reply threading discussion; `blog.twitch.tv` — theater mode (2014), Shield Mode, Chat Highlights (2022), pinned chat.
- YouTube: `support.google.com/youtube` — moderate live chat, Super Chat, premiere countdowns, latency tiers, age-restricted content, stats for nerds, live chat moderation tools, ban appeals.
- Kick: `help.kick.com` — moderation features, viewer/streamer controls, chat moderation.
- Discord: `discord.com/blog` — threads; `support.discord.com` — threads FAQ.
- Owncast: `owncast.online/docs` — embedded chat, website customization.

Third-party emote/chat ecosystem:

- 7TV — zero-width emotes, personal-emote subscriptions.
- BetterTTV (BTTV) — emote modifiers (`w!` / `h!` / `v!` / `z!`).
- FrankerFaceZ (FFZ) — animated + zero-width emote support.
- Chatterino, Chatty — third-party chat clients with mention filtering and context menus.
- Nightbot, Fossabot, StreamElements, Sery_Bot — moderation/chatbot ecosystem.

Research / governance:

- CHI 2023: Understanding Moderators' Conflict and Conflict Management Strategies in Live Streaming Communities.
- IMX 2021 (Cai et al.): Understanding the Voluntary Moderation Practices in Live Streaming Communities.
- Santa Clara Principles on Transparency and Accountability in Content Moderation.
- Getstream livestream best-practices guides, Stream Chat React SDK.

UX reference:

- W3C WAI — captions and live media accessibility.
- WebAIM — captions, transcripts, audio descriptions.
- Video.js and Vidstack player API docs for control-bar fade conventions.
- Mobbin glossary — skeleton loading UI pattern.
