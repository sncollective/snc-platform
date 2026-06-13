---
id: research-handoff-privacy-consent-compliance-2
kind: story
stage: drafting
tags: [community]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: privacy-consent-compliance
created: 2026-06-13
updated: 2026-06-13
---

# Marketing emails: List-Unsubscribe + List-Unsubscribe-Post headers

Every marketing-class email (band go-live / new-content notifications, lifecycle/funnel-to-
subscription) must carry a one-click unsubscribe. Two requirements converge:

- **CAN-SPAM**: a functioning opt-out mechanism on every commercial email; opt-out honored within
  10 business days; the link must stay live ≥30 days; no fee or account creation to opt out.
- **Deliverability**: Gmail (2024) and Yahoo (2024) require `List-Unsubscribe` +
  `List-Unsubscribe-Post` one-click headers for bulk senders, or inbox placement degrades.

**Proposed change:** the self-hosted SMTP / Nodemailer path must emit `List-Unsubscribe` and
`List-Unsubscribe-Post` headers on all marketing-class emails, and every marketing email must
carry a plain "unsubscribe from all" (not only a multi-step preference center). Transactional
emails (OTP, verification, password reset, billing receipts) are exempt.

## Research grounding

**Source**: `privacy-consent-compliance` campaign (org research band), Position 5 — "Email
classification drives unsubscribe obligations."

The classification of S/NC's specific email types and the operational header requirement come from
the campaign's applied-policy-UX facet; the CAN-SPAM mechanics are grounded in the US-compliance
facet (15 U.S.C. §7704 + 16 CFR §316.5).
