# S-NC.tv — Roadmap

> Roadmap for [S-NC.tv vision](VISION.md).

## Phase 1: Infrastructure

**Goal:** Owncast and Restreamer are deployed on Proxmox, the full RTMP→HLS pipeline works, and stream status is exposed through the S/NC API.

**Deliverables:**
- *(user)* Owncast LXC container (RTMP 1935 + HTTP 8080) behind Caddy at `stream.s-nc.org`
- *(user)* Restreamer LXC container (RTMP 1936 + HTTP 8181) behind Caddy at `relay.s-nc.org`
- *(user)* OBS test stream through the full pipeline (OBS → Restreamer → Owncast → browser)
- `StreamStatusSchema` in `@snc/shared` (isLive, viewerCount, timestamps)
- Owncast API client service (`services/owncast.ts`, follows `wrapExternalError` pattern)
- `GET /api/streaming/status` public endpoint, feature-gated route mount

**Done when:**
- OBS stream reaches Owncast and plays in a browser via the Owncast URL
- `/api/streaming/status` returns live/offline state and viewer count
- Infrastructure survives a 1-hour test stream without intervention

## Phase 2: Live Stream Page

**Goal:** Viewers watch live streams on S-NC.tv with no account required.

**Deliverables:**
- `/live` route with Owncast HLS player embed
- Stream status component (live/offline state, viewer count)
- "Live" link in nav with live indicator dot
- Offline state with messaging (no stream currently active)

**Done when:**
- Viewer navigates to `/live` and watches an active stream
- Nav indicator shows live/offline state in real time
- Page works for unauthenticated visitors

## Phase 3: Scheduling + Chat

**Goal:** Creators schedule time slots on the shared channel. Viewers see the schedule and chat alongside the stream.

**Deliverables:**
- `stream_schedule` table (creatorId, title, description, startsAt, endsAt, status)
- Schedule CRUD endpoints (list, create, update, get)
- Schedule display on the live page (upcoming streams)
- Owncast chat iframe embed alongside the player
- Live page layout update (player + chat side-by-side)

**Done when:**
- Creator creates a scheduled stream slot visible on the live page
- Chat is functional alongside an active stream
- Schedule shows upcoming streams when no one is live

## Phase 4: Webhooks + Notifications

**Goal:** The platform reacts to Owncast events in real time. Subscribers are notified when a stream starts.

**Deliverables:**
- Owncast webhook handler (idempotent dispatch pattern from `webhook.routes.ts`)
- `stream_events` table (idempotency) + `stream_sessions` table (stream records)
- Event handlers for `STREAM_STARTED`, `STREAM_STOPPED`, `VISIBILITY-UPDATE`
- Go-live email notification via existing `sendEmail()` (SMTP already configured)
- *(user)* Owncast ActivityPub federation config (fediverse go-live notifications)

**Done when:**
- Starting a stream creates a session record and fires a go-live email to subscribers
- Stopping a stream closes the session record
- Duplicate webhook deliveries are handled idempotently
- Fediverse followers receive go-live notifications via ActivityPub

## Phase 5: VOD Pipeline

**Goal:** Streams are recorded and stored in Garage S3. Creators review recordings and publish them as subscriber-only VOD content.

**Deliverables:**
- *(user)* Garage LXC container (single-node) with Caddy at `storage.s-nc.org`
- *(user)* `snc-vod` bucket setup and API key provisioning
- S3-compatible `StorageProvider` implementation using `@aws-sdk/client-s3`
- Recording pipeline: capture live stream → upload to Garage → mark ready for review
- `sourceType` field on content schema (`"upload"` | `"stream-recording"`)
- Creator recordings management page (`/settings/recordings`)
- VOD publish flow through existing content system with `visibility: "subscribers"` default

**Done when:**
- A completed stream has a recording in Garage S3
- Creator can review and publish the recording as subscriber-only content
- Published VOD plays through existing content detail pages
- S3 storage provider passes the shared contract test suite

**Spike needed:** The recording capture mechanism (FFmpeg sidecar, Owncast recording plugin, or third-party tool) needs a spike before committing to an approach. The rest of the phase can be designed around a `recordingKey` on the session record regardless of how the recording is captured.

## Phase 6: Simulcast + Dashboard

**Goal:** Streams simulcast to Twitch, YouTube, and other destinations. Streaming KPIs are visible on the cooperative dashboard.

**Deliverables:**
- Restreamer API client service (`services/restreamer.ts`)
- Destination management endpoints (cooperative-member only)
- Dashboard streaming cards (total stream hours, viewer hours, VOD publish rate)
- Emissions schema extension for `streaming-transcoding` and `streaming-delivery` categories

**Done when:**
- Adding a Twitch/YouTube destination simulcasts the stream to that platform
- Dashboard shows streaming activity metrics
- Streaming emissions are tracked in the existing carbon accounting system

## Open Questions

- **Recording capture mechanism** — FFmpeg sidecar on the Owncast LXC, Owncast's built-in S3 recording, or a dedicated recording tool? Spike in Phase 5 will resolve this.
- **Stream key management** — Restreamer as ingest point with per-session creator validation, or simpler fixed-key approach? Needs decision before Phase 3 (scheduling).
- **Custom HLS player** — Replace Owncast iframe with native hls.js for quality selection and mobile polish. Not phased here — revisit after Phase 6 based on viewer feedback.
