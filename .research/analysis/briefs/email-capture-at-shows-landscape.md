---
title: Email capture at shows — capture surface, ingestion, and conversion (build-vs-buy scout)
provenance: agent-synthesis
verification_rigor: standard
temporal_contract: write-once-on-converge
created: 2026-06-06
consumer: /scope (email-capture feature) + build-vs-buy decision
---

# Email capture at shows — build-vs-buy landscape

A focused scout to settle the approach before scoping a feature: how to capture audience emails at live shows (sign-up sheet + QR), pull them into the platform, and — the load-bearing twist — funnel sign-ups into **donating/subscribing to the band**. Standard rigor; recommendation feeds `/scope`, does not commit the build.

## The decision in one line

The conversion goal **decides the build-vs-buy question**: the platform's reason to capture emails is to funnel fans into its *own* recurring revenue (Stripe + patronage). A bought fan-CRM funnels into *its* commerce rails, not yours — so the strategic default is **build platform-native capture**, with pragmatic fast-paths for speed and paper sheets.

## Capture surface — three options

| Option | What it is | For | Against |
|---|---|---|---|
| **A. Buy a fan-CRM** (Laylo / Set.live) | Purpose-built drop platform: QR/RSVP/social capture of email+SMS+DM into an owned list, auto-message on drop [laylo-creators]{2}, [qr-at-shows-fan-capture]{4} | Fastest to live; battle-tested incentive UX (QR + prize + 1-click); strong at-show capture | Relationship + data live **off-platform**; commerce hooks are Shopify/tickets (FEVO), **no Stripe/subscription hook stated** [laylo-creators]{2} — so it can't funnel into platform patronage. Cedes the owned audience the platform exists to build |
| **B. Hosted form → webhook** (Tally / Typeform) | A hosted signup form; each submission POSTs signed JSON to a platform endpoint | Cheap (Tally webhooks are free), fast to wire; platform **owns the data**; signed + retried delivery [tally-webhooks]{1} | Still an external surface for the form; styling/consent UX constrained by the tool; another vendor in the path |
| **C. Platform-native signup page** | QR → a platform landing route → direct DB write → contact in identity/community → CTA into commerce | Owns the **capture surface** end-to-end (at-capture UX + consent enforcement + direct write, no external vendor); reuses identity (signup/OTP) + commerce (Stripe/patronage) | Most build effort; must get the at-show UX (1-click, fast, offline-tolerant) as good as the purpose-built tools |

## Cross-cutting dimensions

**Ingestion path.** A signed webhook is the clean machine path for option B — Tally fires `FORM_RESPONSE`, POSTs JSON, and signs with an HMAC-SHA256 `Tally-Signature` header verified against a secret, with a 10s timeout and 5 retries [tally-webhooks]{1}. Option C writes straight to the DB. **Regardless of surface, a CSV import path is a day-one necessity** — paper sign-up sheets at shows are unavoidable (not every fan scans), and they arrive as a spreadsheet to bulk-import. API-pull is the weakest option (polling vs push) and only relevant if a chosen tool lacks webhooks.

**Consent (compliance-by-construction).** An email address alone is not consent. Valid consent needs an explicit checkbox + a privacy-policy link + a timestamped record of when/how/what-was-said; double opt-in is **best practice but not GDPR-mandated** [iubenda-gdpr-double-opt-in]{3}. At-show capture should therefore record consent + policy-version + timestamp at capture, and a confirmation (double opt-in) is recommended for list quality. {extends} A native surface (C) makes this easiest to enforce; a hosted form (B) can do it but the UX is the vendor's; a bought CRM (A) holds the consent record off-platform.

**Conversion — the platform's structural advantage.** The direct-to-fan playbook is: the email list is the *owned layer* that funnels fans into **one** primary subscription home [direct-to-fan-funnel]{5}. The platform's edge is that it owns **both** — the email layer *and* the subscription home (Stripe/patronage) — so capture→subscribe collapses into one flow with no cross-tool hand-off. That is precisely the seam a bought CRM leaves open [laylo-creators]{2}. Lead the feature with this: a captured email is a platform contact that can be invited straight into a patronage/donate CTA.

## Recommendation (for `/scope`)

1. **Capture surface → build native (C)**, copying the purpose-built incentive UX (QR → 1-click signup tied to an at-show incentive) rather than buying the vendor. Rationale: **both B and C land the contact in-platform** (so either can funnel into patronage — data-unification is not unique to native), but native uniquely owns the **capture surface** — the at-capture UX, consent enforcement *at the moment of capture*, and a direct DB write with no external form vendor in the path. Given the conversion goal is platform-owned recurring revenue, owning the capture surface (not just the resulting data) is what justifies the build over the hosted-form fast-path.
2. **Ship pragmatically.** If native-page build is slow, a **Tally-webhook fast-path** [tally-webhooks]{1} gets capture live in days with signed ingestion and platform-owned data — a legitimate v1 or fallback, not the end state.
3. **CSV import is mandatory regardless** — for paper sheets and as the universal escape hatch.
4. **Consent baked in** [iubenda-gdpr-double-opt-in]{3}: checkbox + policy link + timestamped log at capture; double opt-in confirmation recommended.
5. **Funnel hook is the differentiator** [direct-to-fan-funnel]{5}: wire capture → an existing/planned subscribe/donate CTA in the commerce domain; make that the feature's headline, not an afterthought.

## Contradictions / tensions

- **Speed vs ownership** — buying Laylo is fastest but structurally cedes the owned audience + the Stripe/patronage funnel; building native is slower but is the whole point. Not a true contradiction once the conversion goal is the deciding criterion (it favors native), but the speed cost is real and the Tally fast-path is the mitigation.
- No source contradicted another on the mechanics; the divergence is strategic (vendor-owned vs platform-owned), surfaced above.

## Open questions for `/scope`

- At-show **offline tolerance** — venue wifi/cell is unreliable; does the native page need offline-queue/PWA behavior, or is a hosted form more robust here? (A genuine point *for* option B worth testing.)
- Is the capture contact a **full identity record** (reuse signup/OTP) or a lighter "lead" record promoted to identity on subscribe?
- Which **conversion CTA** exists today vs needs building (is patronage/subscribe live, or also pending)?
- SMS as a second channel (Laylo's core is SMS+email) — in scope or later?

## Disconfirming / reliability notes

- Laylo's figures ("$1B", "7x better", "10,000+ creators") are **vendor-marketing, self-reported** [laylo-creators]{2}; the at-show capture stats ("70% of list growth during tours") are **search-summary, uncorroborated** [qr-at-shows-fan-capture]{4}, and the funnel conversion ranges are likewise second-hand [direct-to-fan-funnel]{5}. None are asserted as measured fact; they are directional. The source-direct, verifiable substrate is the Tally webhook contract [tally-webhooks]{1} and the GDPR consent requirement [iubenda-gdpr-double-opt-in]{3}.

## Bibliography

1. `tally-webhooks` — Tally webhooks help doc (tool-doc, source-direct)
2. `laylo-creators` — Laylo creators landing page (blog-post/marketing, source-direct)
3. `iubenda-gdpr-double-opt-in` — iubenda, GDPR double opt-in (blog-post, source-direct)
4. `qr-at-shows-fan-capture` — QR-at-shows fan-capture pattern (blog-post, **search-summary**)
5. `direct-to-fan-funnel` — direct-to-fan email→subscription funnel (blog-post, **search-summary**)
