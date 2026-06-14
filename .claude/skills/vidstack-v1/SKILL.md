---
name: vidstack-v1
description: >
  Vidstack v1 media player reference for React. Auto-loads when working with
  MediaPlayer, MediaProvider, useMediaState, useMediaPlayer, vidstack, video player,
  audio player, HLS, DASH, media playback, captions, streaming, picture-in-picture.
user-invocable: false
updated: 2026-04-16
---

# Vidstack React Reference

> **Version:** 1.12.13 (`@vidstack/react`)
> **Docs:** https://vidstack.io/docs
> **License:** MIT — React 18/19 compatible

UI component library for building accessible video and audio players. Provides headless
components, pre-built layouts, hooks for reactive state, and automatic HLS/DASH support.
Installed in `apps/web` only.

**IMPORTANT:** This is v1.x. The 0.6.x API (found on some NPM pages) is completely different —
do not reference it. All APIs below are verified against the installed 1.12.13 package.

## Imports

```typescript
// Core player components
import { MediaPlayer, MediaProvider, MediaAnnouncer } from '@vidstack/react'

// Buttons
import {
  PlayButton, MuteButton, CaptionButton, FullscreenButton,
  PIPButton, SeekButton, LiveButton, AirPlayButton, GoogleCastButton,
  ToggleButton,
} from '@vidstack/react'

// Compound components (namespace pattern)
import {
  Controls,      // Controls.Root, Controls.Group (renamed from controls_d)
  Tooltip,       // Tooltip.Root, Tooltip.Trigger, Tooltip.Content (renamed from tooltip_d)
  Slider,        // Slider.Root, Slider.Track, Slider.TrackFill, Slider.Thumb, Slider.Preview, Slider.Value, Slider.Steps (renamed from slider_d)
  TimeSlider,    // TimeSlider.Root, .Track, .TrackFill, .Thumb, .Preview, .Progress, .Chapters, .ChapterTitle, .Thumbnail, .Video, .Value (renamed from timeSlider_d)
  VolumeSlider,  // VolumeSlider.Root, .Track, .TrackFill, .Thumb, .Preview, .Value (renamed from volumeSlider_d)
  QualitySlider, // (renamed from qualitySlider_d)
  AudioGainSlider, // (renamed from audioGainSlider_d)
  SpeedSlider,   // (renamed from speedSlider_d)
  Menu,          // Menu.Root, Menu.Button, Menu.Portal, Menu.Items, Menu.Item (renamed from menu_d)
  RadioGroup,    // RadioGroup.Root, RadioGroup.Item (renamed from radioGroup_d)
  Thumbnail,     // Thumbnail.Root, Thumbnail.Img (renamed from thumbnail_d)
  Spinner,       // Spinner.Root, Spinner.Track, Spinner.TrackFill (renamed from spinner_d)
} from '@vidstack/react'

// Display components
import { Captions, Poster, Time, Title, ChapterTitle, Gesture, Track } from '@vidstack/react'

// React hooks
import {
  useMediaState, useMediaStore, useMediaContext,
  useMediaPlayer, useMediaProvider, useMediaRemote,
  useSliderState, useSliderStore, useSliderPreview,
  useTextCues, useActiveTextCues, useActiveTextTrack, useChapterTitle,
  useThumbnails, useActiveThumbnail,
} from '@vidstack/react'

// Menu option builder hooks
import {
  useVideoQualityOptions, useCaptionOptions, usePlaybackRateOptions,
  useAudioOptions, useAudioGainOptions, useChapterOptions,
} from '@vidstack/react'

// Pre-built layouts (separate entry point — SSR-safe import separately)
import { DefaultVideoLayout, DefaultAudioLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import { PlyrLayout, plyrLayoutIcons } from '@vidstack/react/player/layouts/plyr'

// Icons (100+ media icons — separate entry point)
import { PlayIcon, PauseIcon, MuteIcon, VolumeHighIcon, ... } from '@vidstack/react/icons'

// CSS (import order matters)
import '@vidstack/react/player/styles/base.css'           // Required: core styles
import '@vidstack/react/player/styles/default/theme.css'   // Default theme colors
import '@vidstack/react/player/styles/default/layouts/video.css' // Video layout
import '@vidstack/react/player/styles/default/layouts/audio.css' // Audio layout
// Or Plyr theme:
import '@vidstack/react/player/styles/plyr/theme.css'

// Tailwind plugin (if using Tailwind)
// tailwind.config.js: plugins: [require('@vidstack/react/tailwind.cjs')]
```

## API Quick Reference

### Basic Player Setup

```typescript
<MediaPlayer
  src="https://example.com/video.mp4"
  aspectRatio="16/9"
>
  <MediaProvider />
  <DefaultVideoLayout icons={defaultLayoutIcons} />
</MediaPlayer>
```

**MediaPlayer key props:**
- `src` — URL string, `{ src, type }` object, or array of sources
- `aspectRatio` — e.g. `"16/9"`, `"4/3"`
- `streamType` — `"live"` | `"on-demand"` (default)
- `autoPlay`, `muted`, `loop`, `playsInline`, `controls`
- `crossOrigin` — CORS setting for media element

**MediaProvider props:**
- `loaders` — Custom provider loaders (YouTube, Vimeo, Remotion)
- `mediaProps` — Props passed to native `<video>`/`<audio>` element
- `children` — Place `<Track>` elements here for captions/chapters

### SSR Dynamic Import Pattern (Required for TanStack Start)

Vidstack references browser APIs at module initialization. Must use dynamic import:

```typescript
function Player({ src }: { readonly src: string }) {
  const [modules, setModules] = useState<{
    core: typeof import('@vidstack/react')
    layouts: typeof import('@vidstack/react/player/layouts/default')
  } | null>(null)

  useEffect(() => {
    Promise.all([
      import('@vidstack/react'),
      import('@vidstack/react/player/layouts/default'),
    ]).then(([core, layouts]) => setModules({ core, layouts }))
  }, [])

  if (!modules) return <div className={styles.skeleton} />

  const { MediaPlayer, MediaProvider } = modules.core
  const { DefaultVideoLayout, defaultLayoutIcons } = modules.layouts

  return (
    <MediaPlayer src={src}>
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
```

See `apps/web/src/hooks/use-vidstack-modules.ts` for the centralized dynamic import hook used by all player components (`video-player.tsx`, `audio-player.tsx`, `global-player.tsx`).

### Source Formats

```typescript
// File (auto-detected from extension)
src="https://example.com/video.mp4"

// HLS (auto-detected, lazy-loads hls.js)
src={{ src: 'https://example.com/stream.m3u8', type: 'application/x-mpegurl' }}

// DASH (auto-detected, lazy-loads dash.js)
src={{ src: 'https://example.com/manifest.mpd', type: 'application/dash+xml' }}

// YouTube
src="https://youtube.com/watch?v=..."

// Vimeo
src="https://vimeo.com/..."

// Multiple sources (first playable wins)
src={[
  { src: 'video.webm', type: 'video/webm' },
  { src: 'video.mp4', type: 'video/mp4' },
]}
```

### Pre-Built Layouts

**DefaultVideoLayout** — Full video player UI with controls, menus, gestures:

```typescript
<DefaultVideoLayout
  icons={defaultLayoutIcons}
  thumbnails="/thumbnails.vtt"        // Seek preview thumbnails
  download={{ url: '...', filename: '...' }}
  colorScheme="dark"                  // 'light' | 'dark' | 'system'
  smallLayoutWhen={({ width }) => width < 576}
  translations={{ Play: 'Reproducir', ... }}
  noModal={false}                     // Disable mobile bottom-sheet menus
/>
```

**DefaultAudioLayout** — Audio player UI:

```typescript
<DefaultAudioLayout icons={defaultLayoutIcons} />
```

**PlyrLayout** — Plyr-style layout (familiar Plyr look):

```typescript
<PlyrLayout icons={plyrLayoutIcons} />
```

### Headless Components (Custom UI)

Build fully custom player UIs with these primitives:

```typescript
<MediaPlayer src="...">
  <MediaProvider />

  <Controls.Root>
    <Controls.Group>
      <PlayButton />
      <MuteButton />
      <VolumeSlider.Root>
        <VolumeSlider.Track>
          <VolumeSlider.TrackFill />
        </VolumeSlider.Track>
        <VolumeSlider.Thumb />
      </VolumeSlider.Root>

      <TimeSlider.Root>
        <TimeSlider.Track>
          <TimeSlider.TrackFill />
          <TimeSlider.Progress />
        </TimeSlider.Track>
        <TimeSlider.Thumb />
        <TimeSlider.Preview>
          <TimeSlider.Thumbnail.Root>
            <TimeSlider.Thumbnail.Img />
          </TimeSlider.Thumbnail.Root>
        </TimeSlider.Preview>
      </TimeSlider.Root>

      <Time type="current" /> / <Time type="duration" />
      <CaptionButton />
      <PIPButton />
      <FullscreenButton />
    </Controls.Group>
  </Controls.Root>

  <Captions />
  <Poster src="/poster.jpg" alt="..." />
  <Gesture event="pointerup" action="toggle:paused" />
  <Gesture event="dblpointerup" action="toggle:fullscreen" />
</MediaPlayer>
```

### React Hooks

**Read media state reactively:**

```typescript
function MyComponent() {
  const paused = useMediaState('paused')
  const currentTime = useMediaState('currentTime')
  const duration = useMediaState('duration')
  const volume = useMediaState('volume')
  const buffered = useMediaState('bufferedAmount')
  const waiting = useMediaState('waiting')
  const canPlay = useMediaState('canPlay')
  const quality = useMediaState('quality')
  const textTrack = useMediaState('textTrack')
  const isLive = useMediaState('streamType') === 'live'
  // ... many more state properties available
}
```

**Control playback programmatically:**

```typescript
function MyControls() {
  const remote = useMediaRemote()

  return (
    <>
      <button onClick={() => remote.play()}>Play</button>
      <button onClick={() => remote.pause()}>Pause</button>
      <button onClick={() => remote.seek(30)}>Seek to 30s</button>
      <button onClick={() => remote.setVolume(0.5)}>50% Volume</button>
      <button onClick={() => remote.toggleMuted()}>Toggle Mute</button>
      <button onClick={() => remote.toggleFullscreen()}>Fullscreen</button>
      <button onClick={() => remote.togglePictureInPicture()}>PiP</button>
    </>
  )
}
```

**Build menus from options hooks:**

```typescript
function QualityMenu() {
  const options = useVideoQualityOptions({ auto: true, sort: 'descending' })
  return (
    <Menu.Root>
      <Menu.Button>Quality</Menu.Button>
      <Menu.Items>
        {options.map(({ label, selected, select }) => (
          <Menu.Item key={label} onSelect={select} aria-checked={selected}>
            {label}
          </Menu.Item>
        ))}
      </Menu.Items>
    </Menu.Root>
  )
}
```

Other option hooks: `useCaptionOptions`, `usePlaybackRateOptions`, `useAudioOptions`,
`useAudioGainOptions`, `useChapterOptions`.

### Text Tracks (Captions, Subtitles, Chapters)

```typescript
<MediaPlayer src="...">
  <MediaProvider>
    <Track src="/subs-en.vtt" kind="subtitles" label="English" lang="en" default />
    <Track src="/subs-es.vtt" kind="subtitles" label="Spanish" lang="es" />
    <Track src="/chapters.vtt" kind="chapters" label="Chapters" default />
  </MediaProvider>
  <Captions />  {/* Renders active caption text */}
</MediaPlayer>
```

### Thumbnails (Seek Preview)

```typescript
// VTT file with thumbnail sprites
<DefaultVideoLayout icons={defaultLayoutIcons} thumbnails="/thumbnails.vtt" />

// Or programmatic:
const thumbnails = useThumbnails('/thumbnails.vtt')
const active = useActiveThumbnail(thumbnails, currentTime)
```

## Gotchas

**SSR / Dynamic Import (critical):**
Vidstack accesses `window`/`document` during module initialization. In TanStack Start (or any
SSR framework), you MUST dynamically import it client-side. See the pattern above. Static
`import { MediaPlayer } from '@vidstack/react'` will crash during SSR.

**Version warning:**
NPM search results may show 0.6.x documentation. The API is completely different in 1.x.
Do not reference `@vidstack/player` (old package name), `usePlayer()` (removed), or
`<vds-*>` web components (different package). Always verify against types in
`node_modules/@vidstack/react/types/vidstack-react.d.ts`.

**HLS/DASH auto-loading:**
Vidstack lazy-loads `hls.js` and `dash.js` automatically when it encounters HLS/DASH sources.
Do NOT install or import `hls.js` directly — vidstack manages the dependency internally.

**Layout imports are separate entry points:**
`DefaultVideoLayout` comes from `@vidstack/react/player/layouts/default`, NOT from `@vidstack/react`.
Icons come from `@vidstack/react/icons`. These are separate chunks for tree-shaking.

**CSS import order:**
Always import `base.css` before `theme.css` before layout CSS. Missing `base.css` causes
broken rendering. Missing `theme.css` causes unstyled controls.

**`controls` prop vs `<Controls>` component:**
`<MediaPlayer controls>` renders native browser controls.
`<Controls.Root>` renders custom vidstack controls. Don't use both.

**Live streams:**
Set `streamType="live"` on `<MediaPlayer>` for live content. This adjusts UI behavior
(hides duration, shows live edge button, disables seek on DVR-less streams).

## Layout, sizing & control positioning (v1.12.13)

Behavioral/CSS-contract reference for how the player establishes its box and where
`DefaultVideoLayout` puts its controls — the knowledge the API tables above don't carry.
Grounded in the installed `@vidstack/react@1.12.13` source; full cited substrate +
verification in `.research/analysis/campaigns/vidstack-layout-behavior/`.

**Player box sizing:**
- Default video aspect is `:where([data-media-player][data-view-type='video']){aspect-ratio:16/9}`
  — `:where()` makes it **zero specificity**, so any consumer rule overrides it without `!important`.
  The player root is `width:100%` with no default height; aspect-ratio is the sole vertical constraint.
- The **`aspectRatio` prop becomes an inline `style`** (`style={{aspectRatio}}`) → it outranks every
  stylesheet rule. Both platform players pass `aspectRatio="16/9"`, so the box is hard-pinned 16:9.
  To change the ratio, change the prop (or drop it and use a CSS rule of any specificity).
- There is **no `[data-started]:not([data-controls]) → aspect-ratio:inherit` flip** in 1.12.13
  (that selector only sets `pointer-events`/`cursor`). Don't design around one.

**Small vs large layout:** `DefaultVideoLayout` is **small** when the *player* measures
`width < 576 || height < 380` (the `smallLayoutWhen` default; player dimensions, not viewport).
The result sets `data-sm`/`data-lg`/`data-size` on the `.vds-video-layout` **div** (not the player).
Mobile `/live` and the docked mini-player are always small layout; desktop `/live` is large.

**Control positioning + the constrained-container clip (the gotcha):**
- `.vds-controls` overlays `position:absolute; inset:0` on `[data-media-player]` — a **sibling** of
  `[data-media-provider]`, so the provider's `overflow:hidden` does **not** clip controls.
- The bottom controls group is pushed *below* the player box by a **negative margin**:
  large layout `:nth-last-child(2){margin-bottom:-16px}`; small layout `:last-child{margin-top:-2.5px;
  margin-bottom:-6px}`. This is intentional bleed — harmless in default use.
- **A wrapper with a fixed aspect/height + `overflow:hidden` (e.g. for rounded corners) clips that
  protruding control bar** (the LIVE badge + fullscreen). This is the failure mode to watch when
  embedding the player in a tight, rounded, clipped box (mini-player, fixed cards).
- **Fix recipe** — neutralize the bottom group's negative margin *within your wrapper* (exactly what
  Vidstack itself does in fullscreen small layout). The small-layout rule is `:where()`-wrapped
  (zero specificity), so a scoped override wins without `!important`:

```css
.yourWrapper :global(.vds-video-layout[data-sm] .vds-controls-group:last-child) {
  margin-top: 0;
  margin-bottom: 0;
}
.yourWrapper :global(.vds-video-layout:not([data-sm]) .vds-controls-group:nth-last-child(2)) {
  margin-bottom: 0;
}
```

**Styling API surface:** **no `::part()`** (regular DOM, not Shadow DOM). The documented
customization layer is CSS custom properties — `--media-*` (theme primitives, e.g.
`--media-controls-padding`, `--media-live-button-bg`/`-edge-bg`) and `--video-*` (video-layout hooks
that feed `--media-*`, e.g. `--video-border-radius` default `6px` driving player + controls radius).
`.vds-*` classes are real DOM hooks and the only way to target a specific control group, but are
**not a documented stability contract** — pin any `.vds-*` override behind a version-revisit. Re-read
`player/styles/default/layouts/video.css` + the layout JS on each Vidstack upgrade (these are
internal implementation details).

## Anti-Patterns

### Building custom HTML5 video/audio when vidstack handles it

```typescript
// Bad — custom HTML5 for basic playback
<video src={url} controls controlsList="nodownload" />

// Good — vidstack with full accessibility, keyboard, and streaming support
<MediaPlayer src={url}>
  <MediaProvider />
  <DefaultVideoLayout icons={defaultLayoutIcons} />
</MediaPlayer>
```

Vidstack provides WCAG 2.2 accessibility, keyboard shortcuts, and streaming support
out of the box. Only use raw `<video>`/`<audio>` for trivially simple, non-user-facing playback.

### Importing hls.js directly

```typescript
// Bad — managing hls.js yourself
import Hls from 'hls.js'
const hls = new Hls()
hls.loadSource(url)
hls.attachMedia(videoEl)

// Good — vidstack auto-detects and lazy-loads hls.js
<MediaPlayer src={{ src: hlsUrl, type: 'application/x-mpegurl' }}>
  <MediaProvider />
</MediaPlayer>
```

### Static import in SSR context

```typescript
// Bad — crashes during SSR
import { MediaPlayer } from '@vidstack/react'

// Good — dynamic import in useEffect
useEffect(() => {
  import('@vidstack/react').then(mod => setCore(mod))
}, [])
```

### Manual play/pause state tracking

```typescript
// Bad — tracking state manually
const [isPlaying, setIsPlaying] = useState(false)
videoRef.current?.addEventListener('play', () => setIsPlaying(true))

// Good — reactive hook
const paused = useMediaState('paused')
```

### Building custom quality/caption menus

```typescript
// Bad — manually tracking quality levels and captions
const [qualities, setQualities] = useState([])
// ... complex HLS event handling

// Good — option builder hooks
const qualityOptions = useVideoQualityOptions({ auto: true })
const captionOptions = useCaptionOptions({ off: 'Off' })
```

### Building custom controls from scratch

```typescript
// Bad — reimplementing volume slider with <input type="range">
<input type="range" min={0} max={1} step={0.01} value={volume}
  onChange={e => audioEl.volume = e.target.value} />

// Good — headless slider with full accessibility
<VolumeSlider.Root>
  <VolumeSlider.Track>
    <VolumeSlider.TrackFill />
  </VolumeSlider.Track>
  <VolumeSlider.Thumb />
</VolumeSlider.Root>
```

### Forgetting aspect ratio on video player

```typescript
// Bad — layout shift when video loads
<MediaPlayer src="...">

// Good — stable layout
<MediaPlayer src="..." aspectRatio="16/9">
```

## Codebase Context

**Current vidstack usage:**
- `apps/web/src/routes/live.tsx` — HLS live streaming with dynamic import pattern

**Candidates for vidstack migration:**
- `apps/web/src/components/media/video-player.tsx` — bare `<video>` element, no accessibility
- `apps/web/src/components/media/audio-player.tsx` — custom HTML5 audio with manual state
- `apps/web/src/contexts/audio-player-context.tsx` — hand-rolled global playback (Web Audio API
  for volume). Vidstack's hooks + context can replace most of this; Web Audio GainNode may still
  be needed for audio boost beyond 100%.

**Research:**
- `.research/analysis/positions/vidstack-media-player.md` — position record; rationale for Vidstack over Plyr, Media Chrome, Video.js v8, with Video.js v10 as explicit migration watch target
- `.research/analysis/briefs/media-player-libraries.md` — full evaluation with governance analysis and landscape consolidation under Mux
