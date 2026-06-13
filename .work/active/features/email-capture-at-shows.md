---
id: email-capture-at-shows
kind: feature
stage: drafting
tags: [community, commerce]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-06
updated: 2026-06-13
parent: null
---

# Email capture at shows → band followers → subscribe/donate funnel

Capture audience emails at live shows (sign-up sheet + QR) and register them as platform **followers of the band**, then funnel sign-ups into recurring revenue (Stripe subscribe / patronage / donate). **The funnel hook is the headline value, not an afterthought** — a new follower is a platform identity that can be invited straight into a subscribe/donate CTA.

Grounded in the scout brief [`.research/analysis/briefs/email-capture-at-shows-landscape.md`](../../../.research/analysis/briefs/email-capture-at-shows-landscape.md) (build-vs-buy rationale + sources; verified at standard rigor).

## Build-vs-buy — resolved: build native

The conversion goal decides it. The platform's reason to capture emails is to funnel into *its own* recurring revenue (Stripe + patronage); a bought fan-CRM (Laylo) funnels into *its* rails (Shopify/tickets — **no Stripe/subscription hook**), structurally ceding the owned audience. So: **build platform-native capture**, copying the purpose-built incentive UX (QR → 1-click signup tied to an at-show incentive), not buying the vendor.

Nuance the design must respect (from the adversarial-reviewed brief): both a native page *and* a hosted-form-webhook land the contact in-platform — so data-unification isn't unique to native. Native's real, decisive advantage is owning the **capture surface**: the at-capture UX, consent enforcement *at the moment of capture*, and a direct DB write with no external form vendor.

## Scope — the capture→contact→funnel flow

Likely stories (for `/design` to firm + split):

- **Native capture surface** — a QR-targeted signup route/landing page: 1-click, fast, mobile-first, incentive-aware. The at-show UX must rival the purpose-built tools.
- **Contact record + ingestion** — land the contact in the DB. Direct write for the native page; **CSV import is mandatory regardless** (paper sign-up sheets are unavoidable). A hosted-form **Tally-webhook fast-path** (signed JSON `FORM_RESPONSE`, HMAC-SHA256, free) is a legitimate v1/fallback if the native page is slow — design should decide whether to build it as an ingestion adapter or skip.
- **Consent + compliance** — explicit consent checkbox + privacy-policy link + a **timestamped consent log** at capture (email alone is not consent; GDPR needs provable consent, CAN-SPAM needs a working unsubscribe). Double opt-in confirmation optional but recommended for list quality. Ties to backlog `community-unsubscribe-link-emails`.
- **Funnel CTA → commerce** — wire a captured contact into a subscribe/donate/patronage CTA. This is the differentiator; design should make the capture→invite flow first-class. Ties to backlog `community-subscription-lifecycle-emails`.

## Stretch goals — S/NC explainer + subscriber conversion (light touch, user direction 2026-06-13)

Two optional layers on top of the core capture→follow flow, both **per-band configurable and off-by-default-able**:

- **"What is S/NC" explainer for new followers** — a brief post-signup moment that explains the cooperative to someone who just followed a band. The fan arrived for the band, not the org; the explainer earns its place by answering "what did I just sign up for?"
- **Subscriber-conversion CTA with the label framing** — the pitch is *organizational*, not band-personal: subscribing lets S/NC pick up artists like Animal Future as a label and help produce their content. The fan supports the band *through* the cooperative.

**Tone constraint (load-bearing):** the flow must never read as the band shilling for the org. The band's join page is the band's surface; S/NC content is clearly the platform speaking, visually and verbally distinct from the band's voice, skippable, and never gating the follow. If a band turns it all off, the fan gets a clean band-only follow flow.

**Configurability:** each band controls whether the explainer and/or the conversion CTA appear on their join flow (and plausibly the incentive hook, below). Design should decide where this config lives (creator settings) and what the defaults are.

## Settled at code grounding (2026-06-13)

- **Contact-record shape → follower identity for v1** (user direction). The captured email becomes a real user who **follows** the band — reuse the existing better-auth signup (`apps/api/src/routes/auth.routes.ts`) and the existing follow endpoints (`apps/api/src/routes/follow.routes.ts`, `services/follows.ts`); no new contact/lead tier for v1. The lead-record path survives only as the later CSV-import story (paper sign-up sheets), which may then need a light lead table — design that story when it's picked up, not now. Friction note for design: password signup at a merch table is clunky; evaluate a magic-link/OTP path (better-auth plugin) for the join page.
- **Conversion CTA exists — no commerce dependency.** Stripe subscription rails are live (`apps/api/src/routes/subscription.routes.ts`, `services/stripe.ts`, `services/revenue.ts`; web `use-checkout.ts` + pricing page). The funnel hook lands on existing rails.
- **What's genuinely missing** (code survey): QR generation (no dep anywhere — needs a `qrcode` lib + a band-facing "print my QR" surface), a public mobile-first `/join/:creatorSlug`-style route, the signup→auto-follow linkage (carry the creator through signup, fire the follow once the session exists), and the consent surface. Rate-limiting middleware, email service (Nodemailer→Mailpit), and invite-token infra all exist to build on.

## Open questions (for `/design`)

- **At-show offline tolerance** — venue wifi/cell is flaky. Does the native page need offline-queue/PWA behavior, or is a hosted form genuinely more robust at the venue? (The one real point *for* the hosted-form path — test it, don't dismiss it.)
- **SMS as a second channel** — the purpose-built tools center SMS+email. In scope now or a later iteration?
- **Incentive mechanic** — does the at-show CTA need an incentive/prize/exclusive-content hook to convert (the pattern the brief found effective), and does that need its own surface?
- **Where the S/NC explainer/CTA lives in the flow** — post-follow confirmation screen? follow-up email? both? The light-touch constraint (see Stretch goals) bounds the options: never before the follow completes.

## Connections

- Backlog `community-unsubscribe-link-emails` — the unsubscribe surface this feature's outbound consent flow needs (likely absorb or sequence).
- Backlog `community-subscription-lifecycle-emails` — post-capture funnel emails (downstream of the funnel hook).
- Backlog `events-integration-bandsintown-source-of-truth` — the "at shows" context; a captured contact could tie to an event/show.

## Risks

- **Offline capture failure at the venue** — if the native page can't capture without connectivity, sign-ups are lost at the highest-intent moment. Surfaced as the lead open question.
- **Consent debt** — shipping capture without the consent log + unsubscribe is a compliance liability the moment the first email sends. Consent is not a fast-follow; it's part of the capture surface.
- **Org-shilling perception** — if the S/NC explainer/conversion layer feels like the band pushing the org, it damages the band's relationship with its audience (the asset this whole feature exists to grow). The tone constraint and per-band configurability in Stretch goals are the mitigation; design must treat them as hard requirements, not polish.

## Revisit if

- The contact-record decision (identity vs lead) turns out to be cross-cutting enough to warrant a decision record — promote it from `/design`.
