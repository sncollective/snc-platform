---
tags: [refactor, stylistic]
release_binding: null
created: 2026-04-20
---

# ArkUI SelectRoot `as unknown as never` Casts

2026-04-14: `team-section.tsx` ROLE_COLLECTION needs `as unknown as never` cast at 3 `SelectRoot` call sites (lines 149, 288, 521) to satisfy ArkUI v5's invariant `ListCollection<unknown>` prop type. TS rejects `ListCollection<{ value: string; label: string }>` as assignable to `ListCollection<unknown>` because ArkUI's generic isn't covariant.

Landed during 2026-04-14 typecheck-gap Phase B2 as a pragmatic fix. Re-evaluate when ArkUI ships a variance fix upstream, or replace with `createListCollection<{ value: string; label: string }>` + typed `SelectRoot<T>` once the inference path settles. Low priority — contained, documented, not blocking anything.
