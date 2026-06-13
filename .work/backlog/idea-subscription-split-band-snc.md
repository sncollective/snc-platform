---
id: idea-subscription-split-band-snc
created: 2026-06-13
tags: [community, commerce]
---

# Subscriber-chosen subscription amount with band / S/NC revenue split

When subscribing (e.g. from the at-show follower flow's subscribe CTA), the user chooses
a subscription amount AND how the money splits between the band and S/NC — with a floor
for S/NC platform operational costs.

- Suggested amounts and tiers at selection.
- If the creator has defined tiers, their rewards are outlined clearly when choosing.
- S/NC manages its own subscription tiers separately.

Context: surfaced 2026-06-13 while enriching the email-capture-at-shows feature (its
subscribe CTA is the natural entry point). Touches the existing Stripe subscription rails
(`apps/api/src/routes/subscription.routes.ts`, `apps/api/src/services/stripe.ts`,
`apps/api/src/services/revenue.ts`); likely overlaps backlog items
`community-subscription-lifecycle-emails` and `studio-subscriptions-retainers`.
