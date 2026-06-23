---
source_handle: clapshot-features
fetched: 2026-06-23
source_url: https://raw.githubusercontent.com/elonen/clapshot/master/FEATURES.md
provenance: source-direct
---

## Summary

Detailed feature documentation for Clapshot, sourced from the project's own FEATURES.md. Covers the full capability surface as of the fetched version.

## Comment System

- Threaded conversations with reply and visual hierarchy
- **Timeline Integration**: Comments appear as clickable pins on video timeline with color-coded user identification
- Timecode-anchored: comments appear at the frame/time they were posted
- SMPTE timecode display with editable timecode fields for seeking
- Auto-Loop Comments: loops between consecutive comment timestamps
- Admin moderation (edit/delete any comments); users modify only their own

## Drawing Annotations

- 7-color palette (red, green, blue, cyan, yellow, black, white)
- Undo/Redo via Ctrl+Z/Ctrl+Y
- Auto-pause on entering drawing mode
- Real-Time Sync: drawing operations synchronized across collaborative session participants
- Drawings saved as WebP images linked to timestamps

## Real-Time Collaboration

- Shared remote viewing sessions with synchronized playback, seeking, and annotation
- Generates shareable links for collaborative review sessions
- Designed for use during a conference call ("Meant to be used during a conference call or such")

## Approval Workflow

**Not present in core.** No approval states (approved/needs changes/in review) are listed in FEATURES.md. The FEATURES.md references "approval flows" only in the Organizer Plugin section as an example of what a custom plugin *could* implement: "organization-specific workflows (approval flows, archiving, custom integrations)." The Organizer API is documented as "new, still evolving."

## Notification Hook (v0.11.1)

Event types: `comment_added`, `comment_edited`, `comment_deleted`, `message_persisted`, `media_file_added`, `media_file_updated`. Queued, non-blocking, runs on dedicated worker. External script interface via environment variables and stdin JSON.

## Media Processing

FFmpeg-based transcoding with configurable quality; hardware acceleration (Intel QSV, NVIDIA NVENC, VA-API, Apple VideoToolbox); thumbnail generation; waveform visualization for audio.

## Organizer Plugin System

- gRPC communication; any language supported
- Metaplugins: Python files dropped into `/opt/clapshot-org-bf-metaplugins` — no gRPC required
- Metaplugin capabilities: custom popup menu actions, custom command handling, permission check overrides, lifecycle event reactions, custom UI injection via raw HTML + JavaScript
- Developer warning: "the Organizer API is new, still evolving and may change in future releases"

## Version Tracking

No built-in version history or version comparison feature for uploaded media assets is listed.

## File Organization

Hierarchical folder system with drag-and-drop; folder sharing via 32-byte random tokens (requires authentication — no anonymous access).
