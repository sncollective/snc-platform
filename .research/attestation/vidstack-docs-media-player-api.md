---
source_handle: vidstack-docs-media-player-api
fetched: 2026-06-14
source_url: https://www.vidstack.io/docs/player/components/core/player#api-reference
provenance: source-direct
---

## Paraphrase

The official Vidstack docs API reference for the MediaPlayer (top-level) component. Documents all configuration props, state properties, data attributes (CSS hooks), instance methods, and event callbacks.

## Key passages

**`aspectRatio` prop:**
- Type: `string`
- Default: `undefined`
- Purpose: sets the player's aspect ratio. String form (e.g. `"16/9"`, `"4/3"`).

**`streamType` prop:**
- Type: `MediaStreamType`
- Default: `'unknown'`
- Note: if not set it will be inferred by the player, which "can be less accurate."

**`viewType` prop:**
- Type: `MediaViewType`
- Default: `'unknown'`

**`controlsDelay` prop:** number, default 2000 (ms).
**`hideControlsOnMouseLeave` prop:** boolean, default false.

**State properties (via useStore / useMediaState):** `live`, `liveEdge`, `canSeek`, `liveEdgeStart`, `liveEdgeWindow`, `liveDVRWindow`, `isLiveDVR`, `userBehindLiveEdge`, `streamType`, `width`, `height`, `mediaWidth`, `mediaHeight`, `fullscreen`, `pictureInPicture`, `buffering`, `playing`, `paused`, `ended`, `started`, `controls`, `controlsHidden`, `controlsVisible`, `seeking`, `quality`, `qualities`, `muted`, `volume`, `playbackRate`, `textTrack`, `textTracks`, `canPlay`, `canFullscreen`, `canSeek`, `error`, `source`, `sources`, `poster`, `duration`, `currentTime`, `bufferedEnd`, `seekableEnd` (and many others).

**Data attributes on `[data-media-player]`:**
`data-airplay`, `data-autoplay`, `data-autoplay-error`, `data-buffering`, `data-can-airplay`, `data-can-fullscreen`, `data-can-google-cast`, `data-can-load`, `data-can-pip`, `data-can-play`, `data-can-seek`, `data-captions`, `data-controls`, `data-ended`, `data-error`, `data-fullscreen`, `data-google-cast`, `data-ios-controls`, `data-load`, `data-live`, `data-live-edge`, `data-loop`, `data-media-type`, `data-muted`, `data-orientation`, `data-paused`, `data-pip`, `data-playing`, `data-playsinline`, `data-pointer`, `data-preview`, `data-remote-type`, `data-remote-state`, `data-seeking`, `data-started`, `data-stream-type`, `data-view-type`, `data-waiting`, `data-focus`, `data-hocus`.

**Instance methods:** `enterFullscreen()`, `exitFullscreen()`, `enterPictureInPicture()`, `exitPictureInPicture()`, `play()`, `pause()`, `requestAirPlay()`, `requestGoogleCast()`, `seekToLiveEdge()`, `setAudioGain()`, `startLoading()`, `startLoadingPoster()`, `subscribe()`.

**No CSS custom properties** are enumerated on this reference page. Documentation states: "exposes state through HTML attributes and CSS properties for styling purposes" but does not name specific CSS variable names here.

## Structure

Component API reference page. No version segment in URL.
