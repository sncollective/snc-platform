---
id: email-capture-at-shows
kind: feature
stage: drafting
tags: [community, commerce]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-06
updated: 2026-06-10
parent: null
---

# Email capture at shows → platform contacts → subscribe/donate funnel

Capture audience emails at live shows (sign-up sheet + QR), land them as platform contacts, and funnel sign-ups into the band's own recurring revenue (Stripe subscribe / patronage / donate). **The funnel hook is the headline value, not an afterthought** — a captured email is a platform contact that can be invited straight into a subscribe/donate CTA.

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

## Open questions (for `/design`)

- **At-show offline tolerance** — venue wifi/cell is flaky. Does the native page need offline-queue/PWA behavior, or is a hosted form genuinely more robust at the venue? (The one real point *for* the hosted-form path — test it, don't dismiss it.)
- **Contact-record shape** — is a captured email a full **identity** record (reuse signup/OTP) or a lighter **lead** record promoted to identity on subscribe? Affects the identity domain.
- **Which conversion CTA exists today vs needs building** — is subscribe/patronage/donate live, or also pending? Determines whether the funnel hook lands on existing rails or has a dependency.
- **SMS as a second channel** — the purpose-built tools center SMS+email. In scope now or a later iteration?
- **Incentive mechanic** — does the at-show CTA need an incentive/prize/exclusive-content hook to convert (the pattern the brief found effective), and does that need its own surface?

## Connections

- Backlog `community-unsubscribe-link-emails` — the unsubscribe surface this feature's outbound consent flow needs (likely absorb or sequence).
- Backlog `community-subscription-lifecycle-emails` — post-capture funnel emails (downstream of the funnel hook).
- Backlog `events-integration-bandsintown-source-of-truth` — the "at shows" context; a captured contact could tie to an event/show.

## Risks

- **Offline capture failure at the venue** — if the native page can't capture without connectivity, sign-ups are lost at the highest-intent moment. Surfaced as the lead open question.
- **Consent debt** — shipping capture without the consent log + unsubscribe is a compliance liability the moment the first email sends. Consent is not a fast-follow; it's part of the capture surface.
- **Funnel dependency** — if subscribe/donate rails aren't live, the headline value can't land; may need to sequence behind (or scope alongside) the commerce CTA.

## Revisit if

- The contact-record decision (identity vs lead) turns out to be cross-cutting enough to warrant a decision record — promote it from `/design`.
