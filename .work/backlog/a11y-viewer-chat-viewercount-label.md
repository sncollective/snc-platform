---
id: a11y-viewer-chat-viewercount-label
kind: backlog
tags: [streaming, accessibility]
created: 2026-06-12
---

# WCAG: Chat viewer count has no accessible name

## Violation

The chat panel's viewer count is rendered as a plain `<span>` with only a `title` tooltip:

```tsx
/* apps/web/src/components/chat/chat-panel.tsx line 119 */
<span className={styles.viewerCount} title="Viewers in this room">
  {state.viewerCount}
</span>
```

`title` attributes are not consistently exposed by screen readers (many require
hover/focus to announce). A screen reader user navigating the chat panel will encounter
only the number (e.g. "3") without context. The number has no unit ("viewers"), no
room context ("in this room"), and no `aria-label` to provide the semantic meaning that
sighted users get from the visual layout context.

## WCAG Criterion

**1.3.1 Info and Relationships** (Level A): Information conveyed through presentation
(visual context showing the number as a viewer count) must be available programmatically.

**4.1.2 Name, Role, Value** (Level A): User interface components must have an accessible
name.

## File and Line

`apps/web/src/components/chat/chat-panel.tsx:119`

## Severity

2 (minor — the `title` tooltip is present, which some screen readers will announce on
focus, but it is not reliable across all assistive technology; the fix is trivial).

## Fix direction

Add `aria-label={\`\${state.viewerCount} \${state.viewerCount === 1 ? 'viewer' : 'viewers'} in this room\`}`
to the span, replacing the title-only approach. Remove the `title` or keep it for
sighted hover tooltips.
