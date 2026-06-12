---
id: creator-simulcast-url-validation
kind: story
stage: implementing
tags: [streaming, creators]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Validate simulcast destination URLs as RTMP

UX-review finding (creator audit C3 + state inspection, severity 3): the destination
form accepts non-RTMP protocols (an `https://` URL passed client and server validation
silently); the failure surfaces only later when SRS can't forward. Enforce
`rtmp://`/`rtmps://` scheme in the shared Zod schema (single source — server validator
and `zod/mini` client both inherit), with an inline field error. Check both creator
(`simulcast-destination-manager.tsx`) and admin simulcast forms — the component is
shared.

## Acceptance
- [ ] Non-RTMP scheme rejected with an inline field error at submit time
- [ ] Server-side validator rejects it independently (shared schema test)
- [ ] Existing destinations unaffected
