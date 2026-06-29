---
id: gate-refactor-component-boundary-return-types
kind: story
stage: review
tags: [refactor, stylistic]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Exported React component boundaries rely on inferred return types

## Source library
scan-stylistic — rule: annotate-boundaries

## Severity
Medium

## Findings-route
refactor (behavior-preserving)

## Location
`apps/web/src/components/media/global-player.tsx:28` (also `Checkbox`, `RootLayout`)

## Evidence
```tsx
export function GlobalPlayer() {
  const { state, presentation, actions } = useGlobalPlayer();
```

## Remediation direction
Add explicit return types to exported component boundaries, including `GlobalPlayer`, `Checkbox`, and `RootLayout`.

## Implementation (2026-06-29)
- Stage: drafting → review.
- Files changed: `apps/web/src/components/media/global-player.tsx`, `apps/web/src/components/ui/checkbox.tsx`, `apps/web/src/routes/__root.tsx`.
- Tests added: none (type-boundary-only refactor).
- Verification: attempted `bun run --filter @snc/web build`, `bun run --filter @snc/web test`, and commit; blocked before command start by local `bash` failure: `bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory`.
- Discrepancies from design: `GlobalPlayer` can render `null`, so its explicit boundary type is `React.ReactElement | null`.
- Adjacent issues parked: none.
