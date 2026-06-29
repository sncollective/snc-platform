---
id: gate-refactor-picker-dismiss-dedup
kind: story
stage: drafting
tags: [refactor, quality]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Picker close-on-outside / Escape wiring is duplicated between two pickers

## Source library
scan-quality — rule: Duplication / `dedup`

## Severity
Medium

## Findings-route
refactor (behavior-preserving)

## Location
`apps/web/src/components/admin/content-search-picker.tsx:72` (also `PoolItemPicker`)

## Evidence
```tsx
useEffect(() => {
  const handleClickOutside = (e: MouseEvent): void => {
    if (
      containerRef.current &&
```

## Remediation direction
Extract a small shared hook for outside-click/Escape dismissal used by `ContentSearchPicker` and `PoolItemPicker`.
