---
source_handle: vidstack-docs-default-layout
fetched: 2026-06-14
source_url: https://www.vidstack.io/docs/player/components/layouts/default-layout
provenance: source-direct
---

## Paraphrase

The official Vidstack docs page for the DefaultVideoLayout (and DefaultAudioLayout) component. Documents all props with types and defaults, the slot system, data attributes, and the smallLayoutWhen prop contract.

## Key passages

**smallLayoutWhen prop:**
- Type: `boolean | ({ width, height }) => boolean`
- Default: `({ width, height }) => width < 576 || height < 380`
- Description: controls when the small layout variant activates. Accepts a static boolean or a function receiving current player dimensions. Documented as accepting `false` or `'never'` to disable.

**Slot positions (verbatim list):** bufferingIndicator, captionButton, captions, title, chapterTitle, currentTime, endTime, fullscreenButton, liveButton, livePlayButton, muteButton, pipButton, airPlayButton, googleCastButton, playButton, loadButton, seekBackwardButton, seekForwardButton, startDuration, timeSlider, volumeSlider, chaptersMenu, settingsMenu, settingsMenuItemsStart, settingsMenuItemsEnd, playbackMenuItemsStart, playbackMenuItemsEnd, playbackMenuLoop, accessibilityMenuItemsStart, accessibilityMenuItemsEnd, audioMenuItemsStart, audioMenuItemsEnd, captionsMenuItemsStart, captionsMenuItemsEnd. Slots can be prefixed with `before` or `after` to insert content adjacent to a position.

**Data attributes:**
- `data-match` — whether this layout is active
- `data-sm` — small layout active
- `data-lg` — large layout active
- `data-size` — current size string ("sm" or "lg")

**Other relevant props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colorScheme` | string | undefined | "light" or "dark" |
| `icons` | DefaultLayoutIcons | undefined | custom icon set |
| `thumbnails` | string | undefined | Thumbnail VTT URL |
| `translations` | object | undefined | i18n strings |
| `menuContainer` | string | `document.body` | portal container selector |
| `noScrubGesture` | boolean | undefined | disable scrub gesture |
| `disableTimeSlider` | boolean | undefined | disable time slider |
| `noGestures` | boolean | undefined | disable all gestures |
| `sliderChaptersMinWidth` | number | undefined | chapter slider width threshold |
| `slots` | object | undefined | content slot definitions |

**CSS Variables section:** docs confirm CSS variables exist for video layout customization but the variable list is behind a code block that was not returned in the fetched content. Docs state: "The following variables can be used to specifically customize the video layout."

**No `::part()` selectors** documented on this page.

## Structure

Single-page component reference. No version selector visible; URL does not include a version segment.
