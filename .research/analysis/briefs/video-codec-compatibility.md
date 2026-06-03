---
updated: 2026-04-16
---

# Video Codec Compatibility & Browser Playback (March 2026)

Evaluated for the S/NC web platform, which accepts .mp4, .webm, and .mov uploads and serves them via HTML5 video / Vidstack player.

## Current State

The platform validates MIME type only (video/mp4, video/webm, video/quicktime) — no codec inspection, no magic bytes, no ffprobe. A file with an incompatible codec uploads fine but won't play in some browsers.

## Browser Support Matrix

### Video Codecs

| Codec | Chrome/Edge | Firefox | Safari macOS | Safari iOS | Android Chrome |
|-------|-------------|---------|-------------|-----------|----------------|
| **H.264/AVC** | Yes | Yes | Yes | Yes | Yes |
| **H.265/HEVC** | HW decode only (Win/Mac/Android, no Linux) | **No** (no roadmap) | Yes | Yes | Device-dependent |
| **VP8** | Yes | Yes | Yes (16.4+) | Yes (16.4+) | Yes |
| **VP9** | Yes | Yes | Yes (16.4+) | Yes (16.4+) | Yes |
| **AV1** | Yes (70+) | Yes (67+) | Yes (17+) | Yes (17+, HW on A17+) | Yes (HW on SD888+) |

### Audio Codecs (in video containers)

| Codec | Chrome/Edge | Firefox | Safari | Notes |
|-------|-------------|---------|--------|-------|
| **AAC** | Yes | Yes | Yes | Universal. LC-AAC is the safe profile. |
| **Opus** | Yes | Yes | Yes (15+) | Best quality-per-bit. Safe for new transcodes. |
| **Vorbis** | Yes (WebM/Ogg) | Yes | Yes (16.4+) | Legacy; Opus supersedes it. |
| **PCM/LPCM** | No | No | Safari only | Common from professional cameras. |

### Container Format Notes

- **.mp4 (ISOBMFF):** Most broadly supported. H.264+AAC is universally safe.
- **.webm (Matroska subset):** VP8/VP9/AV1 + Vorbis/Opus. Safari support since 16.4.
- **.mov (QuickTime/ISOBMFF):** Chrome/Edge can often play .mov with H.264+AAC (shared container format with MP4), but QuickTime-specific atoms can cause failures. ProRes .mov plays only in Safari on macOS.

## Real-World Problem Scenarios

### iPhone HEVC (.mov) — HIGH prevalence
Default since iPhone 7 / iOS 11 (2017). "High Efficiency" mode records H.265/HEVC in .mov. Direct file uploads (web file picker) send the original HEVC — no automatic transcoding. **Broken in Firefox (all platforms) and Chrome on Linux.**

### macOS Screen Recordings — MODERATE prevalence
Cmd+Shift+5 / QuickTime Player defaults to HEVC on Apple Silicon. Same breakage as iPhone HEVC.

### GoPro / Action Cameras — MODERATE prevalence
GoPro HERO6+ defaults to HEVC for 4K60+. Container is .mp4 (better than .mov for compat), but still broken in Firefox and Linux Chrome.

### Professional Cameras (ProRes) — LOW general, MODERATE for media platform
RED, Blackmagic, Final Cut Pro exports produce ProRes in .mov. **Plays only in Safari on macOS.** Not even Safari on iOS.

### Unusual Audio Codecs — LOW prevalence
PCM/LPCM audio in .mov (professional cameras), AC-3/E-AC-3 (Dolby) in .mp4 — Safari only. Can cause "video plays but no audio" or total failure even when video codec is H.264.

## Detection Approaches

### Server-side: ffprobe (recommended)
```bash
ffprobe -v quiet -print_format json -show_streams input.mp4
```
Returns `codec_name`, `codec_type`, `profile`, `codec_tag_string` for every stream. Key fields:
- `streams[].codec_name`: "h264", "hevc", "vp9", "av1", "prores"
- `streams[].codec_tag_string`: "hvc1" vs "hev1" for HEVC (Safari requires "hvc1")
- `streams[].profile`: "Main", "High", "Baseline" for H.264

FFmpeg is already installed in the dev container (`devcontainer.json`).

### Client-side: Media Capabilities API
```javascript
navigator.mediaCapabilities.decodingInfo({
  type: 'file',
  video: { contentType: 'video/mp4; codecs="hvc1.1.6.L93.B0"', width: 1920, height: 1080, framerate: 30, bitrate: 5000000 }
}).then(result => {
  // result.supported — can play at all
  // result.smooth — will it play smoothly?
  // result.powerEfficient — hardware decode available?
});
```
Supported in Chrome 66+, Firefox 63+, Safari 13+. Useful for playback-time fallback messaging.

### Common codec strings for canPlayType/isTypeSupported
- H.264: `avc1.42E01E` (Baseline), `avc1.4D401E` (Main), `avc1.64001E` (High)
- HEVC: `hvc1.1.6.L93.B0` (Main)
- VP9: `vp09.00.10.08`
- AV1: `av01.0.01M.08`
- AAC: `mp4a.40.2` (LC-AAC)
- Opus: `opus`

## Industry Approaches

Every major platform follows the same pattern:

1. **Accept broadly** — don't reject at upload based on codec
2. **Transcode everything** to a universal delivery format (H.264+AAC baseline, increasingly AV1)
3. **Serve transcoded versions**, not originals
4. **Async processing** — upload completes fast, "processing" state until transcode finishes
5. **Multiple renditions** at different resolutions/bitrates (HLS/DASH)

| Platform | Accepts | Transcodes to | Delivery |
|----------|---------|--------------|----------|
| YouTube | ~20 formats | H.264 + VP9 + AV1 (multiple qualities) | DASH |
| Vimeo | Most common | H.264 + AV1 (Pro tier) | HLS + DASH |
| PeerTube | Common formats | H.264 (FFmpeg on server) | HLS + WebTorrent |
| Cloudflare Stream | Most formats | H.264, AV1 beta | HLS/DASH |
| Mux | Anything | H.264, AV1 option | HLS |

## Safe Delivery Codecs

**Universal baseline (2026):** H.264 (AVC) + AAC in MP4 container. Plays everywhere, no exceptions.

**Modern option:** AV1 + Opus in MP4. All current browsers support it. ~30% better compression than H.264. But: encoding is 10-50x slower, and older mobile devices use battery-heavy software decode.

## HEVC Note

HEVC should never be relied on for web delivery. Firefox has publicly stated they have no plans to support it. Chrome only supports hardware decode (no Linux). Patent licensing complexity adds risk. Always transcode HEVC to H.264 or AV1.

## Decision

For S/NC: accept all codecs at upload, probe with ffprobe, transcode to H.264+AAC MP4 as universal delivery format. Store original alongside transcoded version. This aligns with industry practice and handles the iPhone HEVC problem (the highest-prevalence issue).

The transcoding pipeline converges with three other needs: HLS adaptive streaming, s-nc.tv VOD post-processing, and auto-generated thumbnails. See the media processing pipeline board work for the unified approach.
