---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
related:
  - to: ../briefs/media-player-libraries.md
    type: grounds
    note: full evaluation covering Vidstack / Plyr / Media Chrome / Video.js v8 / Video.js v10, landscape consolidation under Mux, governance and cooperative-values lens, elimination reasoning
  - to: srs-streaming-server.md
    type: cites
    note: SRS produces the HLS streams Vidstack plays (live and VOD)
  - to: garage-object-storage.md
    type: cites
    note: Garage serves VOD content Vidstack loads
revisit_if:
  - Video.js v10 reaches GA (expected mid-2026). Its Technical Steering Committee governance and Apache 2.0 license are a stronger fit for cooperative values than Vidstack's single-maintainer-at-Mux model. At that point, evaluate migration cost against governance gain.
  - Vidstack development stalls or Rahim Alwer leaves Mux / the project without succession. Medium long-term abandonment risk was accepted at selection; if it materializes, migration to Video.js v10 or a fork accelerates.
  - Mux pivots the library in a user-hostile direction (paywalled features, deprecation announcements, aggressive upsell). MIT license protects fork rights but the community would need to pick up maintenance.
  - A fully community-governed media player library emerges under a nonprofit foundation. None exists today — the entire landscape is Mux-connected — but if one appears with comparable React 19 + HLS + accessibility support, it earns an evaluation.
  - React integration patterns shift significantly (React server-first, streaming SSR defaults, or a post-React rendering model) and Vidstack's native-hook approach stops being the cleanest fit.
---

# Position: Vidstack as the media player library, with Video.js v10 as the migration watch target

**Status: settled.** Vidstack is the media player library for S/NC's web platform, adopted with
Video.js v10 explicitly named as the migration watch target for when it reaches GA.

## The stance

**Vidstack (MIT, ~53 kB gzip, native React 19 hooks, first-class TypeScript, built-in HLS/DASH
with lazy-loaded heavy bits, WCAG 2.2 / WAI-ARIA / CVAA accessibility) is the platform's media
player library.** This is a provisional adoption: when Video.js v10 reaches GA (expected
mid-2026), evaluate migration cost against governance gain.

### Primary reasons to adopt now

1. **Best React 19 + TypeScript integration available today**: native hooks (not DOM wrappers),
   no framework adapter layer, clean TanStack Start integration.
2. **Full feature coverage**: built-in HLS/DASH (lazy-loaded, only pulled when needed), buffering
   indicators, keyboard shortcuts, PiP, accessibility baked in.
3. **MIT license protects fork rights** if Mux or single-maintainer governance becomes a problem.
4. **Can't wait for v10**: Phase 2+ playback work needs a player now; the bare `<video>` baseline
   is not viable for the content or live experiences planned.

### The Mux consolidation problem

The creators of Plyr (Sam Potts) and Vidstack (Rahim Alwer) both now work at Mux ($175M+
VC-backed video infrastructure company). Media Chrome is a Mux project. Video.js v10 is a
ground-up rewrite being led by Rahim Alwer at Mux, absorbing Media Chrome's web component
architecture. There is no fully community-governed option in this space — every viable library
has some Mux connection. The Video.js v10 TSC + Apache 2.0 path is the best available future
option, which is why it is the explicit watch target.

## Rejected alternatives

### Video.js v10

Same lead architect as Vidstack (Rahim Alwer). Technical Steering Committee governance +
Apache 2.0 license — the closest thing to cooperative-aligned governance in this space. Bundle
size <5 kB minified. Native React hooks, first-class TypeScript, built-in HLS/DASH, designed
for accessibility. 15-year Video.js track record under v8.

**Why rejected (for now):** Beta status. GA expected mid-2026 but not shippable for Phase 2+
timelines. Adopting beta code for user-facing playback carries unacceptable risk — stability,
breaking changes, partial feature coverage. The decision to migrate when v10 hits GA is
explicit and timed.

### Plyr

Smallest bundle (~7 kB). Clean semantic HTML. Historically strong accessibility.

**Why rejected:** Creator (Sam Potts) has moved on to Video.js v10. Plyr will be archived.
Adopting a deprecated library means a guaranteed migration within 6–12 months, and the migration
target is Video.js v10 anyway — better to skip the detour.

Would reconsider only if a community fork of Plyr emerges with credible maintenance — unlikely
given the creator has clearly signaled Video.js v10 is the successor.

### Media Chrome

Pure web component approach — framework-agnostic. MIT.

**Why rejected:** Being absorbed into Video.js v10. Adopting it now is a two-migration path
(Media Chrome → Video.js v10 when v10 hits GA). The Web Component boundary also limits
TypeScript integration quality compared to Vidstack's native hooks.

Would reconsider only if the absorption stalls and Media Chrome stays as a standalone project
with independent momentum — unlikely.

### Video.js v8 (legacy)

Stable, mature, large community, 15-year track record.

**Why rejected:** Large bundle (~195 kB), poor React/TypeScript integration (wrapper-based),
superseded by v10. The React-friendly story is precisely what v10 fixes; adopting v8 means
staying on the old, heavy, wrapper-based path until v10 GA anyway.

## Accepted trade-offs

- **Bundle size ~53 kB gzip**: larger than Plyr (~7 kB) or Video.js v10 beta (<5 kB). Tree-
  shakeable so unused features don't ship, but baseline is larger.
- **Single-maintainer bus factor (Rahim Alwer)**: mitigated by MIT license and by Alwer's role
  leading Video.js v10 — if Vidstack stalls, v10 becomes the migration path (already the plan).
- **Mux-adjacent governance**: not ideal for cooperative values, but the entire media player
  landscape has this problem.
- **Migration intent carried forward**: this decision is deliberately provisional on Video.js
  v10's GA. The `revisit_if` conditions preserve that intent so the evaluation happens when v10
  ships rather than getting forgotten.

## Platform constraints it sets

- `vidstack-v1` tech-reference skill carries the Vidstack API and component patterns.
- One player library across the platform: live, VOD, review playback, editing preview.
- Accessible playback controls (WCAG 2.2 Level AA baseline).
- GlobalPlayer anchors to the content column on desktop (not the sidebar) — a corollary of the
  context shell navigation pattern (`positions/tv-model-playout-architecture.md`).
