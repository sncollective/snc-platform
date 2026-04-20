---
id: story-error-retry-loading-feedback
kind: story
stage: done
tags: [ux-polish]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Error Retry Loading Feedback

## Overview

Added visual disabled state to the retry button on error pages while a retry is in progress.

## Change

Added disabled styling (reduced opacity + non-default cursor) to the retry button during the retry request. Previously the button remained visually active while the retry was in flight, giving no feedback that the action was being processed.

## Rationale

Without feedback, users may click the retry button multiple times, triggering duplicate requests. The disabled state communicates that the action was received and is being processed, reducing user confusion and duplicate submissions.

## Affected Files

- Error page / error boundary component with retry button (likely in `platform/apps/web/src/`)

## CSS Change

```css
/* Disabled state during retry */
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

The `disabled` attribute is set on the button while the retry request is in flight, and cleared (or the button re-enabled) once the retry resolves or rejects.

## Verification

Trigger an error state, click Retry, and observe that the button becomes visually disabled during the retry. Confirm it returns to normal state after the retry completes (whether successful or unsuccessful).

## 0.2.4 follow-up

Retry button now also shows a "Retrying..." label while the retry is in flight. The 0.2.1 pass added the visual disabled state (opacity + cursor); 0.2.4 polished the text label to make the in-progress state more explicit. Both changes target the same retry button in the error page component.
