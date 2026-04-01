# Job Queues

The API uses [pg-boss](https://github.com/timgit/pg-boss) v12 for background job processing — media probing, transcoding, thumbnail extraction, and playout ingest. Jobs are stored in PostgreSQL (pg-boss auto-creates a `pgboss` schema on first boot), so they survive restarts and have transactional delivery guarantees.

## Queues

Four queues, all with a 7-day retention after completion:

| Queue | Handler | Retry | Timeout | Concurrency | Purpose |
|-------|---------|-------|---------|-------------|---------|
| `media/probe-codec` | `jobs/handlers/probe-codec.ts` | 2 | 5 min | `MEDIA_FFMPEG_CONCURRENCY` (default 2) | FFprobe for codec, resolution, duration |
| `media/transcode` | `jobs/handlers/transcode.ts` | 1 | 2 hours | `MEDIA_FFMPEG_CONCURRENCY` | Re-encode to H.264+AAC MP4 |
| `media/extract-thumbnail` | `jobs/handlers/extract-thumbnail.ts` | 2 | 5 min | `MEDIA_FFMPEG_CONCURRENCY` | Extract JPEG frame at 10% duration |
| `playout/ingest` | `jobs/handlers/playout-ingest.ts` | 1 | 6 hours | 1 (sequential) | Remux source, probe, mark ready |

## Pipeline Flow

### Content upload pipeline

1. `POST /complete` records the upload, sets `processingStatus: "processing"`, and sends a `PROBE_CODEC` job
2. Probe runs ffprobe, stores metadata. If the codec needs transcoding, sends `TRANSCODE`. If there's no thumbnail, sends `EXTRACT_THUMBNAIL`
3. Transcode re-encodes to H.264+AAC, uploads the transcoded file, and sets `processingStatus: "ready"`
4. Thumbnail extracts a JPEG frame and uploads it. Non-fatal — if it fails, the content still goes ready

### Playout ingest pipeline

1. `POST /complete` records the upload, sets `processingStatus: "uploading"`, and sends a `PLAYOUT_INGEST` job
2. Ingest remuxes the source (strips data tracks that hang Liquidsoap), probes for metadata, sets `processingStatus: "ready"`, and regenerates the playlist

## Codec Decision Logic

`requiresTranscode()` from `@snc/shared` determines whether a file needs re-encoding based on the video codec:

- **Transcode:** HEVC, ProRes, VP9, AV1, MPEG-2, MPEG-4, WMV3, VC1
- **Skip (browser-compatible):** H.264, VP8

## Error Handling

Each handler is wrapped in try/catch. The `failContentJob()` helper updates both the job status and the content's `processingStatus` to `"failed"` in one call. Temp files are cleaned up in `finally` blocks regardless of outcome.

Thumbnail extraction is the exception — it's non-fatal. A failed thumbnail doesn't block the content from going ready.

## Lifecycle

Initialized in `index.ts` via `startBoss()`, which calls `registerWorkers()` (defined in `jobs/register-workers.ts`) to set up all four queue handlers.

On `SIGTERM`, pg-boss gets up to 30 seconds to finish in-progress jobs before the process exits. Error events from pg-boss itself are logged through `rootLogger`.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `MEDIA_TEMP_DIR` | `/tmp/snc-media` | Temp directory for download/transcode |
| `MEDIA_FFMPEG_CONCURRENCY` | `2` | Max parallel FFmpeg processes |

## Monitoring

The `processing_jobs` table tracks every job with its status, progress (0-100), and error message. Query by status or type for dashboard or alerting purposes. On the frontend, the `ProcessingIndicator` component shows per-content processing state.

## Database Tables

Three tables carry job-related state:

**`processing_jobs`** — id, contentId, type, status, progress, error, timestamps. The central tracking table for all async work.

**`content`** — processingStatus, videoCodec, audioCodec, width, height, duration, bitrate, mediaKey, transcodedMediaKey, thumbnailKey. Probe results and transcoded/thumbnail file references land here.

**`playout_items`** — processingStatus, sourceKey, sourceWidth, sourceHeight, duration. Playout-specific metadata populated by the ingest job.
