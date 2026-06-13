---
id: research-handoff-privacy-consent-compliance-1
kind: story
stage: drafting
tags: [community, security]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: privacy-consent-compliance
created: 2026-06-13
updated: 2026-06-13
---

# Consent log: capture the exact consent text shown (provability gap)

The at-show consent log (`user_id, consent_type, policy_version, source, captured_at`) proves
*that* consent occurred and which *policy version* was in force, but it cannot prove **what
consent-checkbox text the user actually read** — the checkbox/microcopy is separate from the
policy document and can change independently of `policy_version`.

The EDPB evidentiary standard (Guidelines 05/2020, Para. 108) is explicit that the record must
include "a copy of the information that was presented to the data subject at that time" and that
it is "not sufficient to merely refer to a correct configuration of the respective website."

**Proposed change:** add a `consent_text_version` (or `consent_text_hash`) field to the consent
log, paired with a version-keyed registry of the exact consent-UI text strings, so the log can
reconstruct what was shown at each consent event. Ties to the `email-capture-at-shows` consent
surface.

## Research grounding

**Source**: `privacy-consent-compliance` campaign (org research band), Position 3 — "Consent must
be provable, and the current log can't fully prove it."

The single most concrete platform-side finding of the privacy/consent compliance research: the
current consent log satisfies the GDPR Art. 7(1) demonstrate-consent burden in form but has an
evidentiary gap on the consent-text content the EDPB requires.
