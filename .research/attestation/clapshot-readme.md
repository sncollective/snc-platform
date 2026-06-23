---
source_handle: clapshot-readme
fetched: 2026-06-23
source_url: https://raw.githubusercontent.com/elonen/clapshot/master/README.md
provenance: source-direct
---

## Summary

Clapshot is an open-source, self-hosted tool for collaborative video/media review and annotation, targeting organizations that cannot or will not put media in commercial cloud services. The project is maintained actively (latest release v0.11.1, June 2026).

## Architecture

Four-component architecture:

- **Clapshot Client** — Single Page Application (SPA) running in the browser, written in Svelte
- **Clapshot Server** — Linux daemon handling server-side logic, binary written in Rust. Listens to reverse proxy for HTTP and WebSocket (WSS)
- **Clapshot Organizer(s)** — Plugin(s) that organize media and implement custom workflows. Written in Python (or any language) via gRPC communication
- Supporting: Nginx (TLS reverse proxy), Authentication Proxy, SQLite database (metadata + comments + user messages), FFmpeg + Mediainfo (media processing), file system storage

The repo's primary language is listed as TypeScript on GitHub (likely reflecting recent client changes), with Rust for the server daemon. SQLite stores metadata, comments, and user messages; media files are stored on disk.

## Key Features

- Media support: video, audio, image files with subtitle track management
- HTTP uploads with progress tracking; monitored folder ingestion (files assigned by OS ownership)
- Real-time synchronized playback, drawing annotations (7-color palette), threaded comments
- EDL import as time-coded comments; drawing undo/redo; timeline comment pins
- Hierarchical folder system with drag-and-drop; admin user management
- FFmpeg transcoding with configurable quality; thumbnail generation
- Authentication via reverse proxy (OAuth, JWT, Kerberos, SAML)
- Extensible Organizer Plugin system via gRPC for custom workflows
- Notification Hook system (v0.11.1): scripted notifications to email/Slack/Mattermost on comment add/edit/delete, media file add/update

## License

Server/Client: GPLv2. gRPC/plugin interface libraries: MIT License (dual approach permits proprietary workflow plugins without open-source obligations).

## Deployment

Docker images (single-user and multi-user with HTTP basic auth demos); Debian package installation. Chrome/Chromium desktop recommended.

## Known Limitations

- No built-in approval workflow states (approved/needs changes) in core — this is noted as achievable via Organizer metaplugins
- Mobile/iOS support limited
- Demo authentication (PHP htadmin) not suitable for production — requires external identity provider
