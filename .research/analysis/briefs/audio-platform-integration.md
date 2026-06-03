---
updated: 2026-04-16
---

# Audio Production–Platform Integration (March 2026)

Integration architecture for connecting desktop audio production tools to S/NC's Garage S3 backend, stem interchange format, and media pipeline. Companion to the DAW landscape survey at `audio-production-tools.md`.

## DAW-Agnostic Platform Design

### The Core Principle

The platform doesn't care which DAW produced the audio. It accepts stems — time-aligned audio files with a JSON manifest — from any tool. Pro Tools, Logic, Ardour, Reaper, Ableton, FL Studio. The platform is the publish-and-collaborate layer, not the creative tool.

This is the same model used for video (see `nle-platform-integration.md`): NLEs handle editing, the platform handles everything after.

### DAW Compatibility Matrix

| DAW | License | Stem Export? | Scriptable Export? | Session Format | Parseable? |
|-----|---------|-------------|-------------------|----------------|-----------|
| **Ardour** | GPL-2.0+ | Yes — built-in stem export dialog | Yes — Lua scripting API | XML (.ardour) | Yes |
| **Harrison Mixbus** | Commercial ($79/$399) | Yes — same as Ardour | Yes — same Lua API | XML (.ardour) | Yes |
| **Reaper** | Commercial ($60/$225) | Yes — render dialog with stem mode | Yes — ReaScript (Lua/EEL/Python) | Text (.rpp) | Yes |
| **Tenacity** | GPL-2.0+ | Export Multiple (per-label) | Limited — CLI batch processing | SQLite + XML (.aup3) | Partially |
| **LMMS** | GPL-2.0+ | Per-track export | Limited | XML (.mmp) | Yes |
| **Pro Tools** | Proprietary (subscription) | Bounce per track or Export Clips | No — closed ecosystem | Binary (.ptx) | No |
| **Logic Pro** | Proprietary ($200) | Bounce All Tracks as Audio Files | Limited — AppleScript | Binary (.logicx package) | No |
| **Ableton Live** | Proprietary ($99-$749) | Export Audio/Video per track | Limited — Max for Live | XML inside .als (gzipped) | Partially |
| **FL Studio** | Proprietary ($99-$499) | Export per mixer track | No | Binary (.flp) | No |

Key observations:
- Every major DAW supports stem export in some form — this is a universal workflow, not a niche feature
- Ardour and Reaper are the most scriptable and parseable, making them the strongest candidates for automated integration
- Proprietary DAWs work fine through manual stem export — the platform doesn't need to understand their session formats

### Stem Package Format

The unit of exchange between DAWs and the platform. Professional studios already work this way — S/NC just formalizes the structure.

```
{project-name}/
  manifest.json          # metadata + stem inventory
  stems/
    drums.wav            # time-aligned from bar 1
    bass.wav
    vocals-lead.wav
    vocals-backing.wav
    guitar-rhythm.wav
    guitar-lead.wav
    keys.wav
    fx.wav
  mix.wav                # stereo mix (optional)
  master.wav             # mastered stereo (optional)
```

### manifest.json Schema

```json
{
  "formatVersion": "1.0",
  "title": "Song Title",
  "artist": "Artist Name",
  "sampleRate": 48000,
  "bitDepth": 24,
  "stems": [
    {
      "filename": "stems/drums.wav",
      "label": "Drums",
      "role": "drums",
      "channels": 2,
      "startOffset": 0
    },
    {
      "filename": "stems/bass.wav",
      "label": "Bass",
      "role": "bass",
      "channels": 1,
      "startOffset": 0
    }
  ],
  "mix": "mix.wav",
  "master": "master.wav",
  "bpm": 120,
  "timeSignature": "4/4",
  "duration": 234.5,
  "genre": "rock",
  "credits": [
    { "name": "Jane Doe", "role": "engineer" },
    { "name": "John Smith", "role": "producer" }
  ],
  "version": 2,
  "parentVersion": 1,
  "sessionNotes": "Added overdub guitar, re-balanced drums",
  "exportedFrom": "Ardour 9.2",
  "exportDate": "2026-03-23T14:30:00Z"
}
```

**Required fields:** `formatVersion`, `title`, `artist`, `sampleRate`, `bitDepth`, `stems[]` (each with `filename`, `label`, `role`, `channels`, `startOffset`)

**Optional fields:** `mix`, `master`, `bpm`, `timeSignature`, `duration`, `genre`, `credits[]`, `version`, `parentVersion`, `sessionNotes`, `exportedFrom`, `exportDate`

**Stem roles** (recommended vocabulary, extensible): `drums`, `bass`, `vocals`, `guitar`, `keys`, `strings`, `brass`, `woodwinds`, `synth`, `fx`, `ambient`, `click`, `dialogue`, `foley`, `other`

**File formats:** WAV preferred for interchange (lossless, universally supported, no metadata ambiguity). FLAC acceptable (lossless, ~60% smaller). Lossy formats (MP3, AAC, OGG) for delivery versions only — never as stems.

**Metadata standard position:** Custom JSON schema with BWF (Broadcast Wave Format) field mappings where applicable. BWF's bext chunk fields (originator, description, time reference, UMID) can be represented as JSON properties. AES-X098 (audio session interchange) is too complex and XML-heavy for this use case. The manifest is intentionally simple — a stem package should be creatable by hand in a text editor if needed.

### Per-DAW Export Workflows

**Ardour (recommended for S/NC studio)**
1. Session > Export > select "Stem Export" preset
2. Choose tracks/buses to export as individual stems
3. Set format: WAV, 24-bit, session sample rate
4. Export to `~/S-NC/exports/{project-name}/stems/`
5. Repeat for stereo mix: Session > Export > Master Bus
6. Scriptable via Lua: `Session:export()` API can be invoked from custom scripts or toolbar buttons

**Harrison Mixbus**
Same as Ardour — identical export dialog and Lua API. The console-style mixer is a UI layer; the export pipeline is shared.

**Reaper**
1. File > Render > Source: Stems (Selected Tracks)
2. Set output: WAV, 24-bit, project sample rate
3. Render to `~/S-NC/exports/{project-name}/stems/`
4. Scriptable via ReaScript — can automate the entire export-and-upload flow

**Pro Tools**
1. File > Bounce Mix — select individual tracks, bounce each to disk
2. Or: select all clips on a track, Edit > Consolidate Clip, then export from Region List
3. Ensure all bounces start from the same bar (time-align)
4. Manual process — Pro Tools has no batch stem export equivalent to Ardour/Reaper

**Logic Pro**
1. File > Bounce > Project or Section > All Tracks as Audio Files
2. Select format: WAV, 24-bit, project sample rate
3. Logic handles time alignment automatically when bouncing all tracks
4. macOS only

**Tenacity (podcast/voiceover workflows)**
1. Edit > Labels > label each segment or track
2. File > Export Multiple > By Labels
3. Simpler than DAW workflows — Tenacity is a stereo editor, not a multi-track DAW
4. Best for podcast episodes, voice recordings, and simple audio editing

### Platform Content Schema Integration

How stem packages map to the existing platform infrastructure:

**S3 key structure:**
```
stems/{contentId}/manifest.json
stems/{contentId}/stems/drums.wav
stems/{contentId}/stems/bass.wav
stems/{contentId}/mix.wav
stems/{contentId}/master.wav
```

**Content table relationship:**
- The `mediaKey` on the content table points to the mix or master (the "playable" version)
- Stems are stored alongside, referenced by the manifest
- A future `stemManifestKey` field on the content table could provide a direct pointer to the manifest

**File size considerations:**
- Current `MAX_FILE_SIZES.audio` is 100MB per file (defined in `platform/packages/shared/src/storage.ts`)
- Planned increase to 500MB (per the media streaming design brief)
- A 10-track, 5-minute session at 24-bit/48kHz WAV: ~42MB per stereo track, ~420MB total
- Per-file limits work — individual stems stay well under 500MB even for long sessions
- Total package size is not a platform constraint (S3 doesn't care)

**Upload flow:**
Each stem is uploaded as a separate file via the existing presigned URL flow:
1. Client requests presigned PUT URL for each file (`POST /upload/presign`)
2. Client uploads directly to Garage S3
3. Client calls `POST /upload/complete` for each file
4. After all stems + manifest uploaded, client signals "package complete"
5. Platform validates manifest and queues processing jobs

**MIME types:** Already supported — `audio/wav` and `audio/flac` are in `ACCEPTED_MIME_TYPES.audio`. The manifest is `application/json`.

### Version Tracking

Stem packages are versioned to support iterative collaboration:

- `version` field in manifest (integer, increments)
- `parentVersion` links to the previous iteration
- `sessionNotes` captures what changed ("added overdub guitar", "re-balanced drums")
- Platform stores all versions — collaborators can A/B compare any two
- Each version is a complete stem package (no delta/diff — audio files don't diff meaningfully)

## Ardour Adoption Path

### Who Needs to Switch?

**S/NC's own studio:** Yes — Ardour (or Harrison Mixbus) is the recommended house DAW. Cooperative alignment, no license fees, no vendor lock-in, sustainable governance. The studio hardware is the investment; the software should be open.

**External collaborators:** No. The platform accepts stems from any DAW. An engineer on Pro Tools exports stems, uploads them, done. They never need to touch Ardour.

**New members joining the cooperative:** Encouraged but not required. Ardour training can be part of onboarding, but the stems workflow means anyone can contribute from their existing setup.

### Pro Tools → Ardour Feature Comparison

| Feature | Pro Tools | Ardour 9.x | Gap Assessment |
|---------|-----------|-------------|----------------|
| Multi-track recording | Full | Full | **No gap** |
| Non-destructive editing | Full | Full | **No gap** — regions, fades, crossfades |
| Comping (take lanes) | Full | Full (v7+) | **No gap** — playlist-based comping |
| MIDI sequencing | Full | Good (v6+) | **Minor** — Ardour's MIDI editor is functional but less polished than Pro Tools' |
| Plugin hosting | AAX, VST3, AU | LV2, VST3 (yabridge), CLAP | **Different ecosystem** — see plugin section below |
| Automation | Full | Full | **No gap** — similar automation lanes and modes |
| Elastic Audio / time stretch | Integrated | Via Rubber Band library | **Functional but less integrated** — works, UI is less slick |
| Clip Gain | Full | Full | **No gap** |
| Bus/aux routing | Full | Full | **No gap** — Ardour's routing is actually more flexible |
| Video sync | Full | Basic (v8+) | **Gap** — Ardour can play video in sync but lacks Pro Tools' post-production features |
| Control surfaces | HUI, EUCON, MCU | MCU, OSC, Generic MIDI | **Missing EUCON** — EUCON is Avid proprietary. MCU covers most hardware. |
| Session interchange | AAF/OMF export/import | AAF import only, no export | **One-way** — can import from Pro Tools, can't round-trip back |
| Cloud collaboration | Avid Cloud Collaboration | None (S/NC fills this role) | **S/NC platform replaces this** |
| Surround/Atmos | Up to 7.1.4 Atmos | Arbitrary channel counts | **Different approach** — Ardour handles any channel count but has no Atmos-specific workflow |

**Bottom line:** For recording, mixing, and stem delivery — which is the core studio workflow — Ardour is feature-complete. The gaps are in MIDI polish, video post-production, and Dolby Atmos, none of which are central to S/NC's recording studio operation.

### Harrison Mixbus as a Bridge

For engineers who find Ardour's mixer UI unfamiliar, Harrison Mixbus is the bridge:

- **What it is:** An Ardour fork by Harrison Consoles — the company that builds broadcast and film mixing desks
- **Pricing:** Mixbus ($79), Mixbus 32C ($399) — one-time purchase, not subscription
- **What it adds:** Console-style channel strip on every track (3-band EQ, compressor, tape saturation), analog-modeled summing bus, Harrison's DSP on every channel
- **What it shares:** Same session format as Ardour (`.ardour` XML), same plugin compatibility, same Lua scripting API, same export pipeline
- **Why it helps onboarding:** The mixer looks and feels like an analog console — familiar to anyone who's worked on a real desk. Pro Tools' mixer is also console-modeled, so the mental model transfers.
- **Ardour interop:** Mixbus sessions open in Ardour and vice versa. Engineers can start in Mixbus and transition to Ardour if they want, or stay in Mixbus indefinitely.
- **Governance note:** Harrison is a major Ardour contributor. Their commercial license fees help fund Ardour development. Buying Mixbus directly supports the open-source project.

### Plugin Compatibility

The plugin ecosystem is the biggest adjustment for engineers switching from Pro Tools.

**LV2 (native, open standard)**
1,200+ plugins. The Linux-native format. Key production-grade plugins:
- **LSP Plugins** — parametric EQ, compressor, gate, limiter, reverb, delay. Professional quality, actively maintained.
- **x42 Plugins** — by Robin Gareus (Ardour co-developer). Metering (K-meter, EBU R128, phase), EQ, tuner. Studio-grade.
- **Calf Studio Gear** — compressor, EQ, reverb, flanger, phaser. Solid workhorse plugins.
- **ZamAudio** — compressor, EQ, delay, maximizer. Clean and transparent.
- **Dragonfly Reverb** — algorithmic reverb, well-regarded.
- **ACE (Ardour Community Effects)** — bundled with Ardour. Basic but reliable.

**CLAP (growing, most cooperative-aligned)**
MIT-licensed format by Bitwig and u-he. 90+ plugins and growing:
- **Surge XT** — full-featured synthesizer, open source
- **Vital** — wavetable synthesizer, freemium with open-source core
- Best long-term format for open-source alignment

**VST3 via yabridge (commercial plugin access)**
Wine bridge that runs Windows VST2/VST3 plugins on Linux:
- Covers FabFilter, Waves, iZotope, Soundtoys, UAD (native), and most commercial plugins
- Some latency overhead compared to native plugins
- Occasional compatibility issues with copy-protection schemes (iLok-dependent plugins may need extra configuration)
- Not every plugin works, but coverage is 90%+

**What's missing:**
- **AAX** — Avid proprietary, Pro Tools only. Cannot be used in any other DAW on any platform. Engineers dependent on AAX-only plugins (rare — most vendors ship VST3 too) need alternatives.
- Some commercial plugins have no Linux version and don't work through yabridge. This is uncommon but real.

**Recommended S/NC studio plugin set:**
Maintain a curated, tested LV2/CLAP plugin collection that covers professional production needs. Document equivalences for common commercial plugins:

| Need | Commercial Standard | Open Alternative (LV2/CLAP) |
|------|--------------------|-----------------------------|
| Parametric EQ | FabFilter Pro-Q | LSP Parametric EQ x16 |
| Compressor | Waves CLA-76 / FabFilter Pro-C | LSP Compressor, ZamComp |
| Reverb | Valhalla VintageVerb | Dragonfly Reverb, LSP Room |
| Limiter | FabFilter Pro-L | x42 dpl, LSP Limiter |
| De-esser | FabFilter Pro-DS | LSP De-esser |
| Metering (LUFS) | iZotope Insight | x42 EBU R128 Meter |
| Channel strip | Waves SSL | Harrison Mixbus built-in (if using Mixbus) |

### Training Curve and Resources

**Estimated transition time:**
- Pro Tools → Mixbus: 1–2 weeks (console-style UI transfers well)
- Pro Tools → Ardour: 2–4 weeks (different mixer paradigm, new keyboard shortcuts)
- Logic → Ardour: 2–4 weeks (similar paradigm shift)
- Reaper → Ardour: 1–2 weeks (both are highly configurable, similar philosophy)

**Resources:**
- **Ardour manual** (manual.ardour.org) — comprehensive, maintained by the project
- **Harrison tutorials** — Mixbus-focused but directly applicable to Ardour
- **Unfa** (YouTube) — extensive Ardour tutorials covering recording, mixing, mastering, and Linux audio setup
- **LinuxMusicians forum** — active community for troubleshooting

**The conceptual model is the same.** Tracks, buses, sends, inserts, automation lanes, regions, fades — these concepts are universal across DAWs. The difference is UI layout and keyboard shortcuts, not the underlying paradigm. An experienced engineer isn't learning audio production from scratch; they're learning where the buttons are.

## S3 Integration: Studio-to-Platform Handoff

### Ardour Session Filesystem Layout

Understanding what lives where in an Ardour session:

```
session-name/
  session-name.ardour            # XML session file (references, routing, plugins, automation)
  session-name.ardour.bak        # automatic backup
  session-name.history            # undo history
  interchange/
    session-name/
      audiofiles/                 # recorded audio (WAV) — the raw takes
  export/                         # rendered stems, mixes, masters — what goes to the platform
  plugins/                        # session-specific plugin state/presets
  peaks/                          # waveform display cache (regenerable, not worth storing)
  analysis/                       # spectral analysis cache (regenerable)
```

**What flows to the platform:** Only the contents of `export/` — rendered stems and mixes. The session file, raw recordings, plugin state, and caches stay local in the studio.

**Why not send the session file?** It contains absolute file paths, plugin references, and routing configuration that are specific to the studio's setup. It's not portable. Stems are.

### Watch Folder Pattern

A lightweight mechanism to bridge the gap between "engineer clicks Export in Ardour" and "stems appear on the platform."

**The flow:**
1. Ardour exports stems to a designated local directory: `~/S-NC/exports/{project-name}/`
2. Engineer creates or generates `manifest.json` in the same directory
3. A watcher detects the complete package (manifest + all referenced stems present)
4. Watcher uploads each file via the platform's presigned URL flow
5. Watcher signals "package complete" to the platform API

**Implementation tiers:**

**Tier 1 — Shell script (start here)**
An `inotifywait`-based script that watches the export directory. When a `manifest.json` appears:
- Validates it (jq)
- Uploads each referenced file via `curl` to presigned URLs obtained from the platform API
- Calls the completion endpoint
- Moves the package to an `uploaded/` archive directory

Simple, no dependencies beyond `inotify-tools` and `jq`, works today. The engineer writes the manifest by hand or copies a template and fills it in.

**Tier 2 — CLI tool**
A small Node.js or Python CLI distributed to studio machines:
- `snc-upload init` — generates a manifest template from the WAV files in a directory (auto-detects sample rate, bit depth, duration via ffprobe)
- `snc-upload push` — validates manifest, uploads all files, signals completion
- `snc-upload watch` — daemon mode, watches a directory and auto-pushes when manifest + stems are detected
- Authenticates via API key stored in `~/.config/snc/config.json`

More ergonomic. The manifest is auto-generated from file metadata; the engineer just reviews and edits the labels/roles.

**Tier 3 — Ardour Lua integration**
A custom Ardour Lua script that:
- Hooks into the export completion event
- Generates manifest.json from session metadata (track names → stem labels, session BPM, sample rate)
- Calls the CLI tool or API directly
- One-click export-and-upload from inside Ardour

Most ergonomic, but requires Ardour-specific development. Evaluate after Tiers 1-2 are proven.

**Note on Seafile:** The studio already uses Seafile for desktop file sync (per `object-storage.md`). A Seafile-based approach — sync exports to server, server-side hook detects and ingests — is possible but couples the ingest pipeline to Seafile. Keep it decoupled; the presigned URL flow is the canonical upload path.

### Automated Stem Ingest Pipeline

This extends the planned media pipeline (scoped at `boards/platform/media-pipeline/`) with audio-specific processing.

**Job flow (pg-boss):**

```
Upload complete
  │
  ├─→ audio-probe (per stem)
  │     ffprobe → sample rate, bit depth, duration, channels, codec
  │
  ├─→ lufs-measure (per stem + mix + master)
  │     ffmpeg -af ebur128=peak=true → integrated LUFS, true peak dBTP, loudness range LRA
  │
  └─→ stem-package-validate (after all probes complete)
        ✓ All manifest stems present in S3
        ✓ Sample rates consistent across stems
        ✓ Durations aligned within tolerance (±0.1s)
        ✓ Bit depths consistent
        ✓ LUFS measured for mix/master
        → Generate QC report
        → Set package status: ready | needs-attention
```

**ffprobe metadata extraction:**
```bash
ffprobe -v quiet -print_format json -show_streams -show_format input.wav
```

Key fields:
- `streams[0].sample_rate` — 44100, 48000, 88200, 96000
- `streams[0].bits_per_raw_sample` — 16, 24, 32
- `streams[0].channels` — 1 (mono), 2 (stereo)
- `streams[0].codec_name` — pcm_s24le, pcm_s16le, flac
- `format.duration` — seconds (float)

**LUFS measurement (separate from basic probing):**
```bash
ffmpeg -i input.wav -af ebur128=peak=true -f null - 2>&1
```

Outputs:
- Integrated loudness (LUFS) — the overall loudness of the entire file
- True peak (dBTP) — the highest inter-sample peak
- Loudness range (LRA) — dynamic range measure

This is a heavier operation than basic probing (reads the entire file), so it runs as a separate job.

### Quality Control Gates

QC checks are **advisory, not blocking**. The platform flags issues and lets the creator decide. Professional engineers know their loudness targets; the platform is a safety net, not a gatekeeper.

**LUFS targets by context:**

| Context | Target LUFS | True Peak Ceiling | Standard |
|---------|-------------|-------------------|----------|
| Streaming music | -14 LUFS | -1.0 dBTP | Spotify, Apple Music, YouTube Music |
| Podcast | -16 LUFS | -1.0 dBTP | Apple Podcasts |
| Podcast (Spotify) | -19 LUFS | -2.0 dBTP | Spotify for Podcasters |
| Broadcast (EU) | -23 LUFS | -1.0 dBTP | EBU R128 |
| Cinema | -24 LKFS | -3.0 dBTP | ATSC A/85 |

**Consistency checks:**
- All stems in a package should share the same sample rate (flag if mismatched)
- All stems should share the same bit depth (flag if mismatched)
- Stem durations should align within tolerance (±0.1s) — misalignment usually means a stem wasn't exported from bar 1
- Mix LUFS should not exceed +3 LU above the loudest stem (sanity check for over-compressed masters)

**What the QC report looks like:**
```
Stem Package QC Report — "Song Title" v2
─────────────────────────────────────────
Format: 48kHz / 24-bit / WAV
Stems: 8 files, all consistent ✓
Duration: 234.5s (all stems aligned ✓)

Mix loudness:
  Integrated: -12.3 LUFS
  True peak: -0.8 dBTP
  ⚠ Above -14 LUFS streaming target by 1.7 LU
  ⚠ True peak exceeds -1.0 dBTP ceiling by 0.2 dB

Master loudness:
  Integrated: -14.1 LUFS
  True peak: -1.2 dBTP
  ✓ Meets streaming target
```

### The Complete Handoff Workflow

```
 STUDIO                          PLATFORM                        COLLABORATORS
 ──────                          ────────                        ─────────────

 1. Record in Ardour
    (JACK/PipeWire routing)

 2. Mix in Ardour/Mixbus

 3. Export stems
    Session > Export > Stems
    → ~/S-NC/exports/{project}/

 4. Export stereo mix
    → same directory

 5. Generate manifest.json
    (CLI tool or by hand)

 6. Upload via presigned URLs ──→ 7. Receive upload notifications
                                  8. Queue audio-probe jobs
                                  9. Queue LUFS measurement jobs
                                  10. Validate stem package
                                  11. Generate QC report
                                  12. Set status → ready

                                  13. Stem package visible ──────→ 14. Browse stems on platform
                                      on platform                  15. Download via presigned URLs
                                                                   16. Work in their preferred DAW
                                                                   17. Upload new stem version ──→

                                  18. Track version history
                                  19. A/B comparison available

 20. Review collaborator's
     changes on platform

 21. Final master uploaded ─────→ 22. Transcode to delivery:
                                      MP3 320k, AAC 256k, FLAC
                                  23. Publish through:
                                      - Web feed (s-nc.org)
                                      - RSS / Podcasting 2.0
                                      - Bandcamp-style downloads
                                      - ActivityPub federation
```

## Integration Levels

Build incrementally. Each level adds value independently. Integration depth varies by tool — every creator gets Level 1 regardless of their DAW.

**Level 1 — Media Hub (foundation)** — all DAWs
Upload/download audio via S3. Web playback with the existing player. No tool-specific integration — creators manually export and upload files. **Mostly exists today.**

**Level 2 — Stem Packages** — all DAWs
manifest.json format, multi-file upload, stem-aware content browsing, per-stem playback in browser. Any DAW that can export stems (all of them) can participate. The manifest is simple enough to write by hand. Effort: medium.

**Level 3 — Automated Ingest** — all DAWs benefit, parseable DAWs get more
Watch folder CLI tool, ffprobe + LUFS analysis, QC gates, stem validation. All DAWs benefit from QC and automated upload. For Ardour and Reaper (parseable session formats), the CLI tool can auto-generate the manifest from session metadata — track names become stem labels, session BPM/sample rate fill in automatically. Pro Tools and Logic users create the manifest manually or from a template. Effort: medium.

**Level 4 — Session Round-trip** — Ardour/Mixbus only
This is where the parseable XML session format pays off. The platform can:
- **Generate Ardour session files** with media references pointing to S3 presigned URLs (via redirect endpoint, same pattern as MLT XML for video). Collaborator downloads the `.ardour` file, opens it, stems load from the cloud.
- **Export review comments as Ardour location markers.** Timestamped feedback on the platform ("kick too loud at 1:32") gets written into the session XML. Collaborator opens the session — feedback is on the timeline. This is the Frame.io pattern, replicated without a plugin.
- **Carry mix state.** Not just raw stems — fader positions, EQ settings, automation, routing. A collaborator gets the mix as-is and can adjust, not just a pile of WAV files.
- **One-click export-to-platform** from inside Ardour via Lua scripting. A toolbar button: export stems, generate manifest from session metadata, upload, done. The engineer never leaves the DAW.

Reaper could get partial Level 4 support (parseable `.rpp` format, ReaScript automation), but Ardour is the priority given cooperative alignment. Pro Tools, Logic, Ableton, and FL Studio stop at Level 3 — their session formats are proprietary/binary and can't be generated or parsed by the platform.

Effort: large.

**Level 5 — Collaboration Layer** — all DAWs (built on Levels 2-3), deeper with Ardour
Timestamped comments on individual stems, A/B comparison between versions, remix/fork workflow. All DAWs participate through stem packages. Ardour users additionally get: review comments appearing as session markers (Level 4), version comparison with mix state (not just stems), and the ability to open any version's session directly from the platform.

Effort: large.

### Tool Depth Summary

| Level | Pro Tools | Logic | Ableton | FL Studio | Reaper | Ardour/Mixbus |
|-------|-----------|-------|---------|-----------|--------|---------------|
| 1 — Media Hub | yes | yes | yes | yes | yes | yes |
| 2 — Stem Packages | yes | yes | yes | yes | yes | yes |
| 3 — Automated Ingest | manual manifest | manual manifest | manual manifest | manual manifest | auto manifest | auto manifest |
| 4 — Session Round-trip | — | — | — | — | partial (future) | **full** |
| 5 — Collaboration | stems only | stems only | stems only | stems only | stems only | stems + session |

The proprietary DAWs aren't second-class citizens — Level 1-3 covers the full stem workflow, and that's what most collaboration actually needs. Levels 4-5 are where Ardour's openness creates a qualitatively different experience: the platform and the DAW become aware of each other, instead of just exchanging files.

## What S/NC Would Build

| Component | Level | Description | Where It Lives | Builds On |
|-----------|-------|-------------|---------------|-----------|
| **Stem manifest schema** | 2 | JSON schema + Zod validation for manifest.json | `@snc/shared` | — |
| **Multi-file upload endpoint** | 2 | Accept a stem package (multiple files + manifest) via presigned URLs | `@snc/api` routes | Existing presigned URL flow |
| **Stem browser UI** | 2 | Per-stem playback, waveform display, metadata view | `@snc/web` components | Existing audio player |
| **Audio probe job** | 3 | ffprobe metadata extraction for audio files | `@snc/api` jobs | Planned pg-boss pipeline |
| **LUFS measurement job** | 3 | FFmpeg ebur128 filter for loudness analysis | `@snc/api` jobs | Planned pg-boss pipeline |
| **Stem package validator** | 3 | Verify completeness, alignment, consistency | `@snc/api` jobs | Audio probe + LUFS jobs |
| **QC report generator** | 3 | Advisory loudness/quality report | `@snc/api` services | LUFS measurement |
| **snc-upload CLI** | 3 | Local tool for manifest generation + upload; auto-manifest for Ardour/Reaper | Standalone package | Platform API |
| **Ardour session generator** | 4 | Generate .ardour XML with S3 media URLs + review markers | `@snc/api` services | Stem manifest, redirect endpoint |
| **Ardour Lua export script** | 4 | One-click export-to-platform from inside Ardour | Distributed separately | snc-upload CLI or API |
| **Stem comment model** | 5 | Timestamped comments on individual stems within a package | `@snc/api` schema + routes | Stem packages |
| **Version comparison UI** | 5 | A/B playback between stem package versions, diff view | `@snc/web` components | Stem browser UI |

## Open Questions

- **Manifest metadata standard:** Custom JSON schema with BWF field mappings seems right. AES-X098 is too complex for this use case. Worth adopting BWF's `originator`, `originatorReference`, and `timeReference` fields as optional manifest properties for studios that care about broadcast metadata.

- **Flat files vs archive in S3?** Flat files (each stem as a separate S3 object) are simpler for individual access and presigned URL generation. Add a server-side ZIP endpoint (`GET /stems/{contentId}/download-all`) for bulk download. Don't store ZIPs in S3 — generate on demand.

- **Watch folder CLI authentication:** API keys (simple, stateless, stored in `~/.config/snc/config.json`) are the pragmatic choice. OAuth device flow is more secure but adds complexity for a studio-local tool. Start with API keys, add OAuth later if needed.

- **Ardour Lua API maturity:** Ardour's Lua scripting has been stable since v5. The export API (`Session:export()`) works but documentation is sparse — the Ardour source code and IRC channel are the primary references. Worth a spike to validate the export-hook-to-manifest-generation flow.

- **Stem package size limits:** Per-file limits (500MB planned) work for individual stems. Consider a per-package advisory limit (e.g., 5GB) with warnings rather than hard blocks. A 20-track, 10-minute session at 24/96 WAV is ~3.5GB — large but not unreasonable for a professional recording.

- **Delivery format transcoding:** When the final master is uploaded, the platform should auto-transcode to delivery formats. Target set: MP3 320kbps (compatibility), AAC 256kbps (streaming), FLAC (lossless download). This ties into the planned media pipeline's transcoding jobs.

## References

- `audio-production-tools.md` — DAW landscape survey, plugin ecosystem, collaboration lessons
- `nle-platform-integration.md` — video NLE integration patterns (same model, different medium)
- `org/docs/creative-tool-strategy.md` — strategic thesis: platform as publish layer
- `object-storage.md` — Garage S3 infrastructure, Seafile for studio sync
- `job-queue-libraries.md` — pg-boss evaluation for background processing (decision record at `../.memory/decisions/platform-0003-pg-boss-postgres-job-queue.md`, promoted 2026-04-16)
- `boards/platform/media-pipeline/BOARD.md` — planned media pipeline (audio ingest extends this)
- `boards/platform/media-pipeline/design/pipeline-foundation.brief.md` — media pipeline design brief
