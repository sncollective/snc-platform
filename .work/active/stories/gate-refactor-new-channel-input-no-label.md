---
id: gate-refactor-new-channel-input-no-label
kind: story
stage: implementing
tags: [refactor, accessibility]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# New-channel text input has no accessible label

## Source library
scan-accessibility — rule: form-labels

## Severity
High

## Findings-route
none (behavior-changing — a11y)

## Location
`apps/web/src/routes/admin/playout.tsx:287`

## Evidence
```tsx
<input
  type="text"
  className={[formStyles.input, styles.newChannelInput].join(" ")}
  value={newChannelName}
  onChange={(e) => setNewChannelName(e.target.value)}
```

## Remediation direction
Add a visible `<label>` or `aria-label` tied to this input.
