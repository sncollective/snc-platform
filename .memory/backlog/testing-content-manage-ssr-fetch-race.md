---
tags: [testing, content]
release_binding: null
created: 2026-04-21
---

# Testing: content manage SSR/client fetch race (2026-04-15 CI run)

Four failures — `content-detail.spec.ts:20/67` chromium + mobile, `content-manage.spec.ts:14/39` chromium + mobile. Specs expect seeded content ("Midnight Frequencies", "On Co-ops and Creative Freedom" body). The API confirms both items exist under Maya. `/creators/maya-chen/manage/content` SSRs a `<p>Loading...</p>` shell for both Draft and Published sections; content replaces post-hydration via a client fetch.

Two failure modes to investigate:
1. The client fetch may be failing under Playwright's authenticated context (cookie forwarding issue).
2. The loading state may be exceeding Playwright's 5s default timeout.

Likely fix: convert the content-manage page to a TanStack Start loader so content is server-rendered and available on first paint, eliminating the hydration gap. Cross-board note: the same SSR hydration gap pattern appears on the calendar board for calendar events (tracked separately).

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
