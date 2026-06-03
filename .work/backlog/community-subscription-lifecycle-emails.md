---
tags: [community, commerce]
release_binding: null
created: 2026-04-20
---

# Subscription Lifecycle Emails

Transactional emails for key subscription lifecycle events: welcome (on first subscription), renewal reminder (before next billing cycle), and cancellation confirmation. Depends on the Stripe webhook flow being fully wired — needs deeper scoping before implementation to map which webhook events trigger each email and how they interact with the existing notification dispatch infrastructure.
