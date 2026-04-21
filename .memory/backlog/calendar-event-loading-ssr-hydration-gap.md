---
tags: [calendar, ux-polish]
release_binding: null
created: 2026-04-20
---

# Calendar event loading SSR hydration gap

Events pop in after page load — visible as a flash of empty state followed by the event list appearing. Investigation eliminated a double-fetch as the cause; the remaining gap is in SSR hydration: either the SSR render is not producing event markup, there is a hydration mismatch between server and client, or the loader data is not reaching the initial render path.

Scope when picked up: investigate SSR rendering for the calendar page, check for hydration mismatches in the event list component, and verify that loader data flows through to the initial render rather than being fetched client-side after hydration.
