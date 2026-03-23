# Rule: Media Alternatives

> Video elements must have `<track kind="captions">` and audio content must have a linked transcript.

## Motivation

WCAG 1.2.1 (Audio-only/Video-only, Level A) and 1.2.2 (Captions for Pre-recorded, Level A).
Users who are deaf or hard of hearing rely on captions for video content. Users who can't
play audio rely on transcripts. WebVTT is the standard format. `kind="captions"` includes
dialogue and sound cues (required); `kind="subtitles"` is translation only (not sufficient).

## Before / After

### From this codebase: audio and video players

**Before:** (gap in `apps/web/src/components/media/audio-player.tsx` line 80)
```tsx
{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
<audio ref={preloadRef} src={src} preload="metadata" hidden />
```
The eslint-disable comment explicitly acknowledges the missing caption/transcript.
Audio content needs a linked transcript (not `<track>`, since there's no visual track).

**Before:** (gap in `apps/web/src/components/media/video-player.tsx` lines 14-30)
```tsx
<video controls preload="metadata" controlsList="nodownload" poster={poster}>
  <source src={src} />
</video>
```
No `<track>` element for captions.

**After:**
```tsx
<video controls preload="metadata" controlsList="nodownload" poster={poster}>
  <source src={src} />
  <track kind="captions" src={captionsUrl} srcLang="en" label="English" />
</video>
```

### Synthetic example: audio with transcript link

**Before:**
```tsx
<AudioPlayer src={episode.audioUrl} title={episode.title} />
```

**After:**
```tsx
<AudioPlayer src={episode.audioUrl} title={episode.title} />
{episode.transcriptUrl && (
  <a href={episode.transcriptUrl}>Read transcript</a>
)}
```

## Exceptions

- Audio used purely for UI feedback (notification sounds, button clicks — not content)
- Live-streaming audio/video (different WCAG criteria apply: 1.2.4 at Level AA)
- Media with no spoken dialogue (background music, ambient sound — decorative)
- Video used as a visual background with no informational content

## Scope

- Applies to: `apps/web/src/components/media/` and any component rendering `<video>` or `<audio>`
- Does NOT apply to: test files, server-side code, audio preload elements used only for metadata
