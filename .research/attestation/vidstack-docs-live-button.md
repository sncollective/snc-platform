---
source_handle: vidstack-docs-live-button
fetched: 2026-06-14
source_url: https://www.vidstack.io/docs/player/components/buttons/live-button
provenance: source-direct
---

## Paraphrase

Official Vidstack docs page for the LiveButton component. Documents props, data attributes, and the `onMediaLiveEdgeRequest` callback.

## Key passages

**Purpose:** "displays a live indicator and enables seeking to the live edge when activated." Functions as a button exclusively during live streams.

**Visibility behavior:** The component sets `aria-hidden="true"` when the stream is not live, effectively hiding it during non-live content.

**Props:**
- `asChild` (boolean, default: false)
- `children` (ReactNode, default: null)
- `disabled` (boolean, default: false)

**Callback:**
- `onMediaLiveEdgeRequest` — "Triggered when user presses the button to skip to live position"

**Data attributes:**
| Attribute | Purpose |
|-----------|---------|
| `data-edge` | playback is positioned at the live edge |
| `data-hidden` | current media is not live |
| `data-focus` | keyboard focus state |
| `data-hocus` | keyboard focus or hover state |

**No CSS custom property list** documented on this page directly (CSS variables for live button styling are in the theme CSS source, not explicitly documented on this page).

**No guidance** on small layout vs fullscreen behavior for the LiveButton documented on this page.

## Structure

Component reference page for LiveButton. No version segment in URL.
