---
id: gate-refactor-floating-search-promise
kind: story
stage: implementing
tags: [refactor, stylistic]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Debounced content search promise is handled but not explicitly voided

## Source library
scan-stylistic — rule: no-floating-promises

## Severity
High

## Findings-route
refactor (behavior-preserving)

## Location
`apps/web/src/components/admin/content-search-picker.tsx:53`

## Evidence
```tsx
setIsLoading(true);
searchAvailableContent(channelId, query.trim(), controller.signal)
  .then((data) => {
    setResults(data.items);
```

## Remediation direction
Prefix the handled promise chain with `void` or wrap in an async helper invoked with `void`.
