# Rule: Image Alt Text

> All `<img>` elements must have meaningful alt text; purely decorative images use `alt=""`.

## Motivation

WCAG 1.1.1 (Non-text Content, Level A). Screen readers announce image alt text to describe
the image. Missing `alt` causes the reader to fall back to the filename or skip the image
entirely. Overly generic alt ("image", "photo") provides no useful information.

## Before / After

### From this codebase: content thumbnails

**Before:** (positive example from `apps/web/src/components/content/audio-detail.tsx`)
```tsx
<img src={thumbnailUrl} alt={`Thumbnail for ${item.title}`} />
```
This is correct — the alt text is meaningful and context-specific.

**Before:** (positive example from `apps/web/src/components/media/audio-player.tsx`)
```tsx
<svg aria-hidden="true">...</svg>
```
Decorative SVG correctly marked with `aria-hidden="true"`.

### Synthetic example: missing and generic alt text

**Before:**
```tsx
{/* Missing alt — screen reader announces filename */}
<img src="/uploads/photo-123.jpg" />

{/* Generic alt — provides no useful information */}
<img src={user.avatarUrl} alt="image" />
```

**After:**
```tsx
{/* Meaningful alt */}
<img src="/uploads/photo-123.jpg" alt="Band performing at the Riverside venue" />

{/* Context-specific alt */}
<img src={user.avatarUrl} alt={`${user.displayName}'s avatar`} />

{/* Decorative image — explicit empty alt */}
<img src="/decorative-divider.svg" alt="" />
```

## Exceptions

- SVG icons used alongside visible text labels — use `aria-hidden="true"` on the SVG
- Images inside `<button>` where the button has its own `aria-label`
- `<img>` with `role="presentation"` (functionally same as `alt=""`)
- Images in test files

## Scope

- Applies to: all TSX files in `apps/web/src/`
- Does NOT apply to: test files, server-side only code, API routes
