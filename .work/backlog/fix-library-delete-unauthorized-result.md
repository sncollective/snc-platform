---
id: fix-library-delete-unauthorized-result
tags: [content, security]
release_binding: null
created: 2026-08-07
---

# Return an error when an unauthorized library delete affects no row

`deleteLibraryAsset` scopes its update to the actor's own registration, but currently returns `ok: true` even when the owner-scoped update affects zero rows. The content-library tenant-isolation regression in `apps/api/tests/integration/library.test.ts` is kept as an honest skipped test until this is fixed; it expects a non-owner delete to return `ok: false` while leaving the owner's registration unchanged.
