---
source_handle: platform-content-schema
source_class: tool-doc
fetched: 2026-06-24
source_path: platform/apps/api/src/db/schema/content.schema.ts
provenance: source-direct
tool: Platform — content Drizzle schema
topic: content table columns, processing pipeline fields, reusability for clip data model
---

# Platform — content schema

## Paraphrased summary

The `content` table is the platform's universal content item. It holds a `type` enum
(`video` | `audio` | `written`), `sourceType` (`upload` | ...), `mediaKey` (Garage S3 key
for the media file), `thumbnailKey`, `processingStatus` (`uploaded` → `processing` → `ready`
| `failed`), and technical metadata (`videoCodec`, `audioCodec`, `width`, `height`,
`duration`, `bitrate`). The `transcodedMediaKey` holds the post-transcode file key. All
content items belong to a creator (`creatorId`).

The `processingJobs` table tracks individual pipeline steps: `type` is
`probe` | `transcode` | `thumbnail` | `vod-remux`. The `processing-jobs.ts` service provides
`downloadToTemp`, `uploadFromTemp`, `cleanupTemp`, `createJob`, `updateJob`,
`updateContentProcessing`.

The `streamSessions` table tracks live stream sessions (start/end timestamps, SRS client ID).

## Key passages (schema fields)

**content table:**
- `id`, `creatorId`, `type` (ContentType), `title`, `slug`, `body`, `description`
- `visibility`, `sourceType`, `thumbnailKey`, `mediaKey`
- `videoCodec`, `audioCodec`, `width`, `height`, `duration` (real), `bitrate`
- `processingStatus`, `transcodedMediaKey`

**processingJobs table:**
- `type`: `"probe" | "transcode" | "thumbnail" | "vod-remux"` (from shared types)
- `status`: `"queued" | "processing" | "completed" | "failed"`
- `progress`, `error`, `completedAt`

**streamSessions table:**
- `id`, `creatorId`, `streamKeyId`, `srsClientId`, `srsStreamName`
- `startedAt`, `endedAt`, `peakViewers`

## Structural metadata

- A clip content item would fit the existing `content` table with `type: "video"`,
  `sourceType` extended to include `"clip"`, and `mediaKey` pointing to the extracted clip
  in Garage.
- The `processingJobs` pipeline would need a new `type` value (e.g., `"clip-extract"`) to
  dispatch FFmpeg clip extraction as a pg-boss job.
- The `streamSessions` table provides the `startedAt` timestamp for a stream session —
  enabling calculation of a clip's in/out position relative to stream start.
- No existing field links a clip content item to its source stream or VOD — that would need
  a new column or join table (source content ID + in_offset + out_offset).
