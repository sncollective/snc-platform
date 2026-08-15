---
id: signature-example-chrome-removal
kind: story
stage: done
tags: [design-system, ui]
parent: null
depends_on: []
release_binding: null
gate_origin: operator adjudication 2026-08-15 ("the pills and chips are examples of how to use the branding, not intended to be literal")
created: 2026-08-15
updated: 2026-08-15
---

# Signature example-chrome removal (operator ruling)

## Ruling

The study's pills/chips were **example grammar** demonstrating the branding's signature
lever — not literal content for shipping surfaces. Removed per operator:

- "We boost the signal" tagline sigchip (nav, all pages) — also duplicated the hero
  subheading.
- "24·96" pill (/studio hero) — cryptic without a legend; example content.
- "A1" pill (press header) — same.

## Kept (real, not examples)

- **● LIVE chip** on /live — a functional live-state indicator (org QA f2 token fix);
  `SignatureChip` keeps this consumer, so the component stays (its unused `showcase`
  variant + `.showcase` CSS + the nav test block were trimmed).
- Hero "№ 01" eyebrow + Fraunces register — structural chrome from the liked variants,
  not flagged. (Operator can extend the ruling to it; one commit.)

## Cleanup

Dead `.heroSignature` / `.pressSignature` rules (incl. the responsive override) removed;
nav/studio/press imports cleaned; nav test's sigchip case removed. Hero test's "We boost
the signal" subheading assertion kept — that's the real page copy, not the chip.

**Org FYI queued:** the pills were org QA f4's explicit ask; removal is an operator
product ruling that supersedes it. Morning note when org's box is back.

Verification: full web suite + build green.
