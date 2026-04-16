---
id: platform-0004
title: Vidstack as the media player library, with Video.js v10 as the migration watch target
status: active
created: 2026-03
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "Video.js v10 reaches GA (expected mid-2026). Its Technical Steering Committee governance and Apache 2.0 license are a stronger fit for cooperative values than Vidstack's single-maintainer-at-Mux model. At that point, evaluate migration cost against governance gain."
  - "Vidstack development stalls or Rahim Alwer leaves Mux / the project without succession. Medium long-term abandonment risk was accepted at selection; if it materializes, migration to Video.js v10 or a fork accelerates."
  - "Mux pivots the library in a user-hostile direction (paywalled features, deprecation announcements, aggressive upsell). MIT license protects fork rights but the community would need to pick up maintenance."
  - "A fully community-governed media player library emerges under a nonprofit foundation. None exists today — the entire landscape is Mux-connected — but if one appears with comparable React 19 + HLS + accessibility support, it earns an evaluation."
  - "React integration patterns shift significantly (React server-first, streaming SSR defaults, or a post-React rendering model for the web platform) and Vidstack's native-hook approach stops being the cleanest fit."
---

## Context

The S/NC web platform (React 19 + TypeScript + TanStack Start) needs a media player library for audio and video playback. The baseline is a bare HTML5 `<video>` element, which lacks buffering indicators, keyboard navigation shortcuts, accessibility controls, and adaptive streaming (HLS/DASH). Phase 2+ live and VOD playback require an actual media player; the content board also has a parked item to upgrade bare `<video>` throughout the app.

Three contextual pressures shaped the decision:

1. **Landscape consolidation under Mux.** The creators of Plyr (Sam Potts) and Vidstack (Rahim Alwer) both now work at Mux ($175M+ VC-backed video infrastructure company). Media Chrome is a Mux project. Video.js v10 is a ground-up rewrite being led by Rahim Alwer at Mux, absorbing Media Chrome's web component architecture. There is no fully community-governed option in this space — every viable library has some Mux connection.
2. **Plyr deprecation and Media Chrome absorption.** Plyr's creator has moved to Video.js v10 and Plyr will be archived. Media Chrome is being absorbed into Video.js v10 — adopting it now means an inevitable migration.
3. **Video.js v10 timing.** Beta now, GA expected mid-2026. Promising governance (Technical Steering Committee + Apache 2.0) but not shippable today.

## Alternatives considered

### Vidstack (selected)

See Decision below.

### Video.js v10

**Why considered.** Same lead architect as Vidstack (Rahim Alwer). Technical Steering Committee governance + Apache 2.0 license — the closest thing to cooperative-aligned governance in this space. Bundle size <5 kB minified — much smaller than Vidstack's ~53 kB. Native React hooks, first-class TypeScript, built-in HLS/DASH, designed for accessibility. 15-year Video.js track record under v8.

**Why rejected (for now).** Beta status. GA expected mid-2026 but not shippable for Phase 2+ timelines. Adopting beta code for user-facing playback carries unacceptable risk — stability, breaking changes, partial feature coverage. The decision to migrate when v10 hits GA is explicit and timed.

**Would change our mind if.** v10 reaches GA and real-world production reports are positive. This is the primary revisit trigger on this decision.

### Plyr

**Why considered.** Smallest bundle (~7 kB). Clean semantic HTML. Historically strong accessibility.

**Why rejected.** Creator (Sam Potts) has moved on to Video.js v10. Plyr will be archived. Adopting a deprecated library means a guaranteed migration within 6–12 months, and the migration target is Video.js v10 anyway — better to skip the detour.

**Would change our mind if.** A community fork of Plyr emerges with credible maintenance. Unlikely given the creator has clearly signaled Video.js v10 is the successor.

### Media Chrome

**Why considered.** Pure web component approach — framework-agnostic. MIT.

**Why rejected.** Being absorbed into Video.js v10. Adopting it now is a two-migration path (Media Chrome → Video.js v10 when v10 hits GA). The Web Component boundary also limits TypeScript integration quality compared to Vidstack's native hooks.

**Would change our mind if.** The absorption stalls and Media Chrome stays as a standalone project with independent momentum. Unlikely.

### Video.js v8 (legacy)

**Why considered.** Stable, mature, large community, 15-year track record.

**Why rejected.** Large bundle (~195 kB), poor React/TypeScript integration (wrapper-based), superseded by v10. The React-friendly story is precisely what v10 fixes; adopting v8 means staying on the old, heavy, wrapper-based path until v10 GA anyway.

**Would change our mind if.** Video.js v10 never ships and v8 remains the de facto Video.js option. Unlikely given Mux's stewardship commitment.

## Decision

**Vidstack (MIT, ~53 kB gzip, native React 19 hooks, first-class TypeScript, built-in HLS/DASH with lazy-loaded heavy bits, WCAG 2.2 / WAI-ARIA / CVAA accessibility) is the media player library for S/NC's web platform, adopted now, with Video.js v10 named as the explicit migration watch target for mid-2026.**

Primary reasons to adopt now:

1. **Best React 19 + TypeScript integration available today.** Native hooks (not DOM wrappers), no framework adapter layer, clean TanStack Start integration.
2. **Full feature coverage.** Built-in HLS/DASH (lazy-loaded, only pulled when needed), buffering indicators, keyboard shortcuts, PiP, accessibility baked in.
3. **MIT license protects fork rights** if Mux or single-maintainer governance becomes a problem.
4. **Can't wait for v10.** Phase 2+ playback work needs a player now; the bare `<video>` baseline is not viable for the content or live experiences planned.

Explicit migration plan: when Video.js v10 reaches GA (expected mid-2026), evaluate migration cost. Same lead architect means API patterns may be similar; Apache 2.0 + TSC governance is a meaningful upgrade over Vidstack's single-maintainer-at-Mux model. The migration is a forward-looking intent, not a commitment — evaluation happens when v10 actually ships.

## Consequences

**Enabled:**
- Live page player (first Vidstack usage in the app, landed in the platform's release-0.2 phase 2 work)
- VOD playback with HLS streams delivered from Garage (integrates with [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) and [platform-0002-garage-s3-object-storage.md](platform-0002-garage-s3-object-storage.md))
- Bare `<video>` replacement across the app (content board has a parked upgrade item)
- Accessible playback controls (WCAG 2.2 Level AA baseline)
- One player library across the platform — live, VOD, review playback, editing preview

**Deferred / out of scope:**
- Video.js v10 migration — deliberate watch-and-evaluate rather than a now-decision. Will be revisited mid-2026 based on actual v10 GA state.
- Custom player UI — Vidstack supports this if needed, but not in scope for initial adoption.

**Accepted trade-offs:**
- **Bundle size ~53 kB gzip.** Larger than Plyr (~7 kB) or Video.js v10 beta (<5 kB). Tree-shakeable so unused features don't ship, but the baseline is larger than alternatives. Lazy-loading HLS/DASH keeps the initial payload reasonable.
- **Single-maintainer bus factor (Rahim Alwer).** Mitigated by MIT license (forkable) and by Alwer's role leading Video.js v10 — if Vidstack stalls, v10 becomes the migration path, which was already the long-term plan.
- **Mux-adjacent governance.** Not ideal for cooperative values, but the entire media player landscape has this problem. Video.js v10's TSC + Apache 2.0 governance is the best available future option, which is why it's the explicit watch target.
- **Migration intent carried forward.** This decision is deliberately provisional on Video.js v10's GA. Keeping that intent visible in the `revisit_if` conditions is important so the migration evaluation happens when v10 ships rather than getting forgotten.

## Related

- [../research/media-player-libraries.md](../research/media-player-libraries.md) — full evaluation covering Vidstack / Plyr / Media Chrome / Video.js v8 / Video.js v10, landscape consolidation under Mux, governance and cooperative-values lens, elimination reasoning
- [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) — SRS produces the HLS streams Vidstack plays (live and VOD)
- [platform-0002-garage-s3-object-storage.md](platform-0002-garage-s3-object-storage.md) — Garage serves VOD content Vidstack loads
- Tech-reference skill: [.claude/skills/vidstack-v1/SKILL.md](../../.claude/skills/vidstack-v1/SKILL.md) — Vidstack v1 reference for implementation work

No prior decision record to supersede — this is a fresh promotion from research to a structured decision record as Item 3d of the Level 3 critical path (2026-04-16). No position change from the March 2026 research conclusions. The Vidstack adoption has been load-bearing for release-0.2 phase 2 work and is referenced from the `vidstack-v1` tech reference skill.
