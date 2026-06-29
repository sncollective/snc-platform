---
id: gate-refactor-chat-avatar-img-decoding
kind: story
stage: done
tags: [refactor, seo, performance]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Raw chat avatar images omit `decoding="async"`

## Source library
scan-seo — rule: image-decoding

## Severity
High

## Findings-route
none (behavior-preserving for app logic; browser decode hint)

## Location
`apps/web/src/components/chat/chat-panel.tsx:158` (and `:218`)

## Evidence
```tsx
<img
  src={user.avatarUrl}
  alt=""
  className={styles.userListAvatar}
  width={16}
```

## Remediation direction
Add `decoding="async"` to the raw chat avatar `<img>` tags at lines 158 and 218.

## Implementation (2026-06-29)
Inline single-stride fix (orchestration-pass): applied the gate remediation directly, verified the web build green. No code-path change beyond the named remediation.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
