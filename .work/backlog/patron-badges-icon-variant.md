---
tags: [community, ux-polish]
release_binding: null
created: 2026-04-22
---

# Patron/Sub badges — icon variant

Currently chat badges render as text pills ("Patron", "Sub") per the shipped `patron-badges` feature spec. Surfaced 2026-04-22 during feature review: an icon variant (e.g. lucide `badge-check` / `star` / `gem`) would be more compact in chat rows and more visually distinct at-a-glance.

Design questions to resolve when picked up:

- Icon choice per badge type — distinct icons that read as "platform supporter" vs "channel supporter" without a legend.
- Color/styling — do they keep the accent-bg pill shape, or become bare colored icons?
- Accessibility — tooltip/aria-label on hover/focus ("Platform Patron", "Channel Subscriber").
- Both-badges layout — icons side-by-side, with what gutter and what ordering (platform-first stays per current spec).
- Mobile/compact sizing — icons need tap targets if they're interactive (today they're display-only).
