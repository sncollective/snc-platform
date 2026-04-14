# Object Storage

**Status:** Draft
**Date:** 2026-03-13

Research on self-hosted S3-compatible object storage for S/NC. Evaluates open-source storage backends for uploaded content (user media, platform assets), streaming VOD, and potential Seafile replacement for collaboration files. Covers Garage, SeaweedFS, RustFS, Ceph RGW, and the MinIO situation. Evaluates upload UI libraries (Uppy, FilePond, Dropzone) and upload architecture patterns (presigned URLs, tus protocol, proxied uploads) for building large-file upload into the S/NC platform.

**Key decision:** Garage as S3-compatible storage alongside Seafile (which stays for studio desktop sync with block-level dedup on slow wifi). Upload UI via Uppy with S3 multipart, uploading direct-to-Garage via presigned URLs. File browser UI via SVAR React File Manager. Two separate systems, no bridging — different audiences, clean boundary.

---

## Why Object Storage Now

Seafile CE handles file sync well — block-level dedup, desktop clients, proven with multi-GB media. But several upcoming needs don't fit the Seafile model:

- **Platform uploads** — user avatars, media attachments, content assets uploaded through the web UI need an API-accessible storage layer, not a sync client
- **Streaming VOD** — Owncast doesn't record streams natively; a `STREAM_STOPPED` webhook needs somewhere to land recorded segments for the VOD pipeline
- **Web-based large file upload** — Seafile's own web portal struggles with multi-GB uploads (noted in `../../research/collaboration-suite.md`); a proper chunked upload UI could fill this gap
- **Restreamer recordings** — can write to S3-compatible storage
- **Future services** — any self-hosted service that speaks S3 (Mastodon media, Matrix attachments, game asset CDN) gets a shared backend

The question isn't whether S/NC needs object storage — it's which one, and whether it replaces Seafile or runs alongside it.

---

## Evaluation Criteria

Derived from charter values and existing infrastructure decisions:

- **Open source** — MIT/Apache preferred, AGPL acceptable. No open-core feature gating on core functionality.
- **Self-hosted on Proxmox** — runs in LXC containers on existing infrastructure behind Caddy. Modest hardware — not a datacenter.
- **S3 API compatibility** — multipart upload, presigned URLs, bucket operations. Must work with standard S3 SDKs (`@aws-sdk/client-s3`).
- **Lightweight** — S/NC runs multiple services on a single Proxmox host. Storage shouldn't need 16GB RAM or 3 dedicated nodes.
- **Governance** — community-governed or nonprofit-backed preferred over corporate-controlled projects. MinIO's trajectory is a cautionary tale.
- **Maturity** — production-ready for the core use case (store and serve objects). Doesn't need to be enterprise-scale.
- **Operational simplicity** — small team, can't dedicate a person to storage ops. Single binary or simple Docker deployment preferred.

---

## The MinIO Situation

MinIO was the default self-hosted S3 answer for years. That's over.

**Timeline:**
- **2021:** License changed from Apache 2.0 to AGPL v3
- **Early 2025:** Admin console and management GUI stripped from Community Edition (PR #3509) — bucket management, user admin, policy config all removed from the free version
- **February 2026:** GitHub repository archived. README points users to AIStor, MinIO's commercial product. No new commits, no PRs, no issues, no security patches.

MinIO CE is now a frozen codebase with no web UI and no maintenance. Anyone running it is on borrowed time. This is the context for evaluating alternatives — the "just use MinIO" era is over.

---

## Object Storage Solutions

### Garage (Leading candidate)

[Garage](https://garagehq.deuxfleurs.fr/) is a lightweight S3-compatible distributed object storage service built for self-hosting. AGPL-3.0, Rust, ~2.8k GitHub stars.

**What it does:**
- S3-compatible API (signature v4, presigned URLs, multipart upload — all core operations)
- Single dependency-free binary — no external database, no JVM, no runtime
- Multi-zone replication (3 copies across zones by default)
- Web endpoint for static site hosting from buckets
- Runs on minimal hardware — 1GB RAM, works on Raspberry Pi
- Designed for geo-distributed deployments across heterogeneous hardware

**Governance:** Developed by Deuxfleurs, a French nonprofit focused on self-hosting infrastructure. Funded through EU programs (NGI POINTER 2021-2022, NLnet/NGI0 Entrust 2023-2024, NLnet/NGI0 Commons Fund 2025). This is the strongest governance model of any option — nonprofit-backed, publicly funded, no corporate pivot risk.

**S3 compatibility (verified):**
- Fully supported: GetObject, PutObject, DeleteObject, CopyObject, HeadObject, all multipart operations, presigned URLs, ListObjects/V2, bucket CRUD
- Partially supported: lifecycle (abort incomplete multipart + expiration only), website hosting (index/error docs only)
- Not supported: versioning, ACLs/policies (uses its own per-key-per-bucket permission model), object locking, tagging, notifications

**Resource requirements:** 1GB RAM minimum, x86_64 or ARM, 16GB disk minimum, 200ms latency tolerance across nodes.

**Limitations:**
- 3x storage overhead (replication, no erasure coding) — a 1TB dataset uses 3TB of disk
- Small development team (~1.5 FTE funded through grants)
- No web management UI (CLI-only administration via `garage` command)
- No native IAM/OIDC — access is managed through API keys bound to bucket permissions
- Some advanced S3 features missing (versioning, object lock)

**License:** AGPL-3.0 — copyleft. Self-hosted deployment is fine. Modifications to Garage itself must be released under AGPL. Interacting via S3 API from the platform is fine (API boundary).

### SeaweedFS (Strong alternative)

[SeaweedFS](https://github.com/seaweedfs/seaweedfs) is a distributed storage system with S3 gateway, FUSE mount, and WebDAV. Apache 2.0, Go, ~30.9k GitHub stars.

**What it does:**
- S3-compatible API via gateway that translates to native Filer API
- Blob store with O(1) disk seek — fast even with billions of files
- Multiple access methods: S3 API, FUSE mount, WebDAV, Hadoop
- Erasure coding for warm/cold data (more storage-efficient than replication)
- Cloud tiering — async replication to AWS S3, GCS, Azure, BackBlaze
- Cross-datacenter replication

**Governance:** Independent open-source project. Primary maintainer is @chrislusf. No foundation backing, no nonprofit structure. Enterprise edition exists at seaweedfs.com — open-core model. Not foundation-hosted (CNCF, Apache, etc.), so governance depends on a single maintainer's continued involvement.

**S3 compatibility:** Good for common operations. The S3 gateway translates to SeaweedFS's native API, which works well for standard use but edge cases in S3 behavior may differ from AWS. SSE-KMS, IAM, and lifecycle features are catching up (2025 roadmap).

**Resource requirements:** ~512MB RAM minimum — extremely memory-efficient. Master-volume architecture separates metadata from data storage.

**Limitations:**
- More complex architecture than Garage — master server + volume servers + filer + S3 gateway (multiple components)
- UI maturity weaker than MinIO's old console — more CLI/config work
- Open-core model: enterprise features (encryption at rest, advanced replication) are proprietary
- Single primary maintainer risk — bus factor

**License:** Apache 2.0 — permissive, no restrictions on use or modification. Enterprise features are separately licensed.

### RustFS (Not production-ready — watch)

[RustFS](https://github.com/rustfs/rustfs) is a Rust-based S3-compatible object storage positioning itself as the MinIO successor. Apache 2.0, ~growing GitHub community.

**What it does:**
- S3-compatible API with AWS Signature v4
- Built-in web management console (unlike Garage)
- Claims 2.3x faster than MinIO for small object payloads
- Policy-based access control compatible with AWS IAM

**Governance:** Open-source under Apache 2.0. New project without established governance structure.

**Why it's not recommended yet:**
- Alpha status (v1.0.0-alpha as of early 2026)
- Distributed mode not officially released
- Performance claims are project-reported benchmarks, not independently verified
- Too new to trust with production data

**When to reconsider:** If RustFS reaches stable release with distributed mode and gains production users, it becomes a strong MinIO replacement — Apache 2.0, Rust performance, built-in UI.

**License:** Apache 2.0 — no restrictions.

### Ceph RGW (Not recommended for S/NC's scale)

[Ceph](https://docs.ceph.com/en/reef/radosgw/) RADOS Gateway provides S3-compatible object storage on top of Ceph's distributed storage platform. LGPL 2.1/3.

**Why it's not recommended:**
- Minimum 3 nodes, each wanting 16+ GB RAM and dedicated storage
- 10 GbE networking at minimum
- Operational complexity far exceeds S/NC's needs — Ceph is a distributed storage platform, not an S3 endpoint
- Designed for petabyte-scale enterprise deployments

**When relevant:** Only if S/NC scales to the point where it operates dedicated storage infrastructure across multiple servers. Not foreseeable.

**License:** LGPL 2.1/3 — permissive for internal use.

---

## Comparison Table

| | Garage | SeaweedFS | RustFS | Ceph RGW | MinIO CE |
|---|---|---|---|---|---|
| **License** | AGPL-3.0 | Apache 2.0 | Apache 2.0 | LGPL 2.1/3 | AGPL-3.0 |
| **Governance** | Nonprofit (Deuxfleurs), EU-funded | Solo maintainer, open-core | New project, no structure | Foundation-backed, mature | Archived (Feb 2026) |
| **Language** | Rust | Go | Rust | C++ | Go |
| **Min RAM** | 1 GB | ~512 MB | ~2 GB | 16+ GB | N/A (dead) |
| **Min nodes** | 1 (single-node mode) | 1 | 1 | 3 | N/A |
| **S3 multipart** | Yes | Yes | Yes | Yes | N/A |
| **Presigned URLs** | Yes | Yes | Yes | Yes | N/A |
| **Erasure coding** | No (replication only) | Yes | Unclear | Yes | N/A |
| **Web UI** | No | Basic | Yes (console) | Via dashboard | Stripped |
| **Maturity** | Stable, small community | Stable, large community | Alpha | Very mature | Dead |
| **Stars** | ~2.8k | ~30.9k | Growing | N/A | 50k+ (frozen) |
| **Operational complexity** | Low (single binary) | Medium (multi-component) | Low | High | N/A |

---

## Upload Architecture

The storage backend is half the problem. The other half is getting large files from the browser to storage reliably. Three patterns:

### Pattern 1: Presigned URL (direct-to-storage)

```
Browser ──── presigned PUT ────> Garage/S3
   ^                                |
   |                                |
   └── Hono API (issue URL) ───────┘
```

1. Browser requests an upload URL from the Hono API
2. API authenticates the user, generates a presigned PUT URL (time-limited, scoped to a specific key)
3. Browser uploads directly to the storage endpoint
4. On completion, browser notifies the API to record metadata in Postgres

**Pros:** API server doesn't handle file bytes. Scales naturally — storage handles the load. Standard S3 pattern.

**Cons:** Storage endpoint must be exposed (behind Caddy at e.g. `storage.s-nc.org`). CORS configuration required. Client-side multipart chunking needed for large files.

**Best for:** S/NC's architecture. Caddy already handles TLS termination. The API stays lightweight.

### Pattern 2: tus Protocol (resumable upload server)

```
Browser ──── tus protocol ────> tus server (tusd or tus-node-server)
                                     |
                                     v S3 multipart
                                  Garage/S3
```

1. Browser uses tus client (via Uppy's `@uppy/tus` plugin) to upload to a tus server
2. tus server handles chunking, resume state, and writes to S3 via multipart upload internally
3. Upload state persists server-side — browser can close and resume later

**Pros:** True resumability (server tracks state, not just client). Protocol-level standard — any tus client works. `tus-node-server` 2.0 is web-standards based and has an S3 store backend.

**Cons:** Extra server component to run (tusd Go binary or tus-node-server). Upload traffic flows through the tus server, not direct-to-storage. More moving parts.

**Best for:** If upload reliability on bad connections is critical (field recordings, remote collaborators with unstable internet). More robust than client-side multipart retry.

### Pattern 3: API proxy (simplest, doesn't scale)

```
Browser ──── multipart form ────> Hono API ────> Garage/S3
```

1. Browser uploads to the API server
2. API streams the file to storage

**Pros:** Simplest to implement. No CORS, no exposed storage endpoint. Auth is handled naturally.

**Cons:** API server bottlenecks on file transfer bandwidth and memory. Doesn't scale. No pause/resume without extra work.

**Not recommended** for large files. Fine for small uploads (avatars, thumbnails) under ~50MB.

### Recommended approach: Presigned URLs for large files, API proxy for small files

Use presigned URLs (Pattern 1) for content uploads, media files, and anything over ~50MB. Use API proxy (Pattern 3) for small, simple uploads where the overhead isn't worth it. Keep tus (Pattern 2) as an upgrade path if field conditions demand it — the migration from presigned URLs to tus is straightforward since Uppy supports both.

---

## Upload UI Libraries

### Uppy (Recommended)

[Uppy](https://uppy.io/) is a modular file uploader for the browser. MIT license, TypeScript, backed by Transloadit, v5.2.1 (January 2026).

**What it does:**
- Drag-and-drop file selection with progress bars, pause/resume
- S3 multipart upload via `@uppy/aws-s3` plugin — batch presigned URL support (v5.2 reduced server roundtrips by 75% for large files)
- tus resumable upload via `@uppy/tus` plugin
- React, Vue, Svelte, Angular framework wrappers
- Cloud source imports (Google Drive, Dropbox, etc. via Companion server — optional)
- Image editing and compression
- Headless mode (bring your own UI) or pre-built Dashboard component
- i18n support

**Why Uppy over alternatives:**
- Only open-source library with native S3 multipart + presigned URL support
- Only one with tus protocol support (upgrade path to Pattern 2)
- React wrapper (`@uppy/react`) integrates cleanly with TanStack Start
- Active development, large community, well-documented
- Modular — install only what you need

**Integration with S/NC platform:**

```
@uppy/core          — orchestrator
@uppy/dashboard     — pre-built UI (or @uppy/react for headless)
@uppy/aws-s3        — S3 multipart with presigned URLs
```

The Hono API exposes a `/uploads/presign` endpoint that returns presigned URLs. Uppy's `@uppy/aws-s3` plugin calls this endpoint, gets URLs, and uploads directly to Garage. On completion, the frontend calls the API to record the upload metadata.

**License:** MIT — no restrictions.

### FilePond (Lighter alternative)

[FilePond](https://pqina.nl/filepond/) is a file upload library with image optimization. MIT license, JavaScript.

**What it does:**
- Clean, polished upload UI with smooth animations
- Image preview, transform, and compression plugins
- Framework adapters (React, Vue, Svelte, Angular)
- Lightweight — smaller bundle than Uppy

**Limitations for S/NC:**
- No native S3 multipart support — requires custom server-side handling
- No tus protocol support
- No presigned URL flow — uploads go through the server
- S3 integration requires writing a custom upload endpoint that proxies to storage

**When to consider:** If the upload use case stays small (profile pictures, thumbnails) and the full Uppy machinery isn't needed.

**License:** MIT — no restrictions.

### Dropzone (Legacy — not recommended)

[Dropzone](https://www.dropzone.dev/) is a drag-and-drop upload library. MIT license, JavaScript, widely used but aging.

**Limitations:** No S3 support, no tus support, no multipart chunking, no resume. Would require building all large-file handling from scratch.

**License:** MIT — no restrictions.

---

## Upload Library Comparison

| | Uppy | FilePond | Dropzone |
|---|---|---|---|
| **License** | MIT | MIT | MIT |
| **S3 multipart** | Native plugin | No (custom server) | No |
| **Presigned URLs** | Native plugin | No | No |
| **tus resumable** | Native plugin | No | No |
| **Pause/resume** | Yes | No | No |
| **React wrapper** | Official | Official | Community |
| **Headless mode** | Yes | No | Yes |
| **Bundle size** | Larger (modular) | Small | Small |
| **Cloud sources** | Google Drive, Dropbox, etc. | No | No |

---

## Integration Effort

### What we'd build

Assuming Garage + Uppy with presigned URLs:

**Backend (Hono API):**
1. S3 client setup — `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` configured to point at Garage
2. Presigned URL endpoint — `POST /uploads/presign` — authenticated, returns presigned PUT URL + upload ID
3. Upload completion endpoint — `POST /uploads/complete` — records metadata (filename, size, content type, S3 key, uploader) in Postgres
4. Serve endpoint — `GET /uploads/:id` — returns presigned GET URL or proxies the download

**Frontend (TanStack Start):**
1. Uppy integration — `@uppy/core` + `@uppy/aws-s3` + `@uppy/react`
2. Upload component — wraps Uppy Dashboard or builds custom UI with headless hooks
3. Progress/status UI — Uppy handles this natively
4. File browser/gallery — shows uploaded content from the API

**Infrastructure:**
1. Deploy Garage in Proxmox LXC (single-node mode for now, multi-node later)
2. Caddy config for `storage.s-nc.org` — reverse proxy to Garage's S3 endpoint with CORS headers
3. Garage bucket setup — create buckets, generate API keys

### Effort estimate

This is a medium-lift feature, not a major project:

| Component | Scope |
|-----------|-------|
| Garage deployment | ~1 session — single binary, LXC, Caddy config |
| Hono presign/complete endpoints | ~1-2 sessions — straightforward S3 SDK work |
| API - list/get/delete/copy/move | ~2-3 sessions — S3 SDK wrappers for file operations |
| Uppy integration + upload component | ~2-3 sessions — Uppy does the heavy lifting, UI/UX polish takes time |
| File browser UI (SVAR File Manager) | ~2-3 sessions — SVAR handles the chrome (list/grid views, context menus, breadcrumbs, keyboard shortcuts), wire to API |
| Media preview (image, audio, video) | ~1-2 sessions — inline `<img>`, `<audio>`, `<video>` with presigned URLs, PDF embed |
| Share links | ~1-2 sessions — Postgres table, generate/revoke, public download route with optional password + expiry |
| Postgres schema for upload/file metadata | ~1 session — Drizzle migration |
| Testing + edge cases | ~1-2 sessions — large file testing, error handling, CORS |

**File browser accelerator:** [SVAR React File Manager](https://svar.dev/react/filemanager/) (MIT, React 18/19) provides list view, grid/tiles view, split pane, breadcrumb navigation, file tree sidebar, context menus, keyboard shortcuts, drag & drop between folders, and image preview — all out of the box. It's backend-agnostic, so S/NC wires it to the Hono API which talks to Garage via S3 SDK. This eliminates the biggest chunk of frontend UI work.

Most of the complexity is in the upload UX and file browser polish, not the storage backend. Garage and the S3 SDK handle storage. Uppy handles chunking, progress, retry. SVAR handles the file browser UI. The platform glues them together with presigned URLs and metadata.

---

## Seafile Relationship — Decided: Run Both

Garage and Seafile are separate systems with no file-level interop. Seafile uses its own internal block-level storage format — files in Garage won't appear in Seafile libraries and vice versa. This is accepted as the right tradeoff.

**Why not unify:**
- Seafile Pro supports S3 backends, but it's Pro-only (proprietary) and still stores files in Seafile's block format on S3 — not as standard objects readable by other S3 tools
- A sync bridge (watching Garage uploads and pushing to Seafile via API, or vice versa) is technically possible but adds a service to maintain while fighting two storage models
- Mounting Garage via rclone as a desktop drive would unify storage, but loses Seafile's block-level dedup — on slow wifi (the primary studio's current situation), a small change to a 4GB session would re-upload the entire file instead of just the changed blocks

**Decision: two systems, two audiences, clean boundary.**

| Who | Tool | Why |
|-----|------|-----|
| Studio team (local machines, slow wifi) | Seafile desktop client | Block-level dedup — only changed chunks upload over constrained connections |
| Platform users (web browser) | Garage + web file manager | S3 multipart upload via Uppy, media preview, share links |
| Services (Owncast VOD, Restreamer, etc.) | Garage S3 API | Standard S3 interface for any service that speaks it |

| Need | Seafile | Garage |
|------|---------|--------|
| Desktop file sync (studio sessions) | Yes — block-level dedup, SeaDrive | No |
| Web-based large file upload | Weak (known limitation) | Strong (multipart + Uppy) — better than Seafile's web UI |
| Platform API storage (avatars, media) | No — not an API-first tool | Yes — S3 API |
| Streaming VOD landing zone | No | Yes — webhook writes to S3 |
| Service backends (Mastodon, Matrix, etc.) | No | Yes — any S3-speaking service |
| Shared team folder browsing | Yes — web portal + clients | Yes — SVAR file browser in platform UI |
| File versioning | Yes — block-level | No — not in scope |

**Reassessment trigger:** If the studio's internet situation improves significantly (wired connection, faster upload speeds), the dedup advantage shrinks and a single Garage + rclone setup becomes viable. Until then, Seafile stays for studio sync.

---

## Recommendation

### Storage: Garage — leading candidate

Garage is the best fit for S/NC's values and infrastructure:

1. **Governance** — nonprofit-backed (Deuxfleurs), EU-funded, AGPL-3.0. No corporate pivot risk. This is the strongest governance story of any option.
2. **Operational simplicity** — single binary, 1GB RAM, runs in an LXC container alongside everything else. No multi-component architecture to manage.
3. **S3 compatibility** — multipart upload, presigned URLs, all core operations. Enough for the platform's needs.
4. **Scale fit** — designed for small self-hosted deployments, not enterprise. That's exactly what S/NC is.

**Tradeoffs accepted:**
- 3x storage overhead from replication (acceptable at S/NC's data volumes, and single-node mode avoids this)
- No web admin UI (CLI is fine for a small team)
- Smaller community than SeaweedFS (offset by nonprofit stability)
- AGPL means modifications to Garage must be published (S/NC isn't modifying Garage — just using the S3 API)

**When to reconsider SeaweedFS:** If S/NC's storage needs grow significantly (billions of files, multi-TB hot data, need for erasure coding), or if the Apache 2.0 license matters for a specific integration. SeaweedFS is the more capable system — it's just more complex to operate and has weaker governance.

### Upload: Uppy + presigned URLs

Uppy with `@uppy/aws-s3` multipart, uploading directly to Garage via presigned URLs issued by the Hono API. Pre-built Dashboard component for the initial implementation, headless mode for custom UI later.

### File browser: SVAR React File Manager

[SVAR](https://svar.dev/react/filemanager/) (MIT, React 18/19) for the browsing UI — list/grid views, breadcrumbs, context menus, keyboard shortcuts, drag & drop. Wired to the Hono API.

### Architecture: Garage alongside Seafile — decided

Two systems, clean split. Seafile for studio desktop sync (block-level dedup on slow wifi). Garage for web uploads, platform storage, service backends. No bridge, no sync between them.

---

## Resolved Decisions

- **Single-node Garage** — no replication overhead, back up via Proxmox snapshots and rclone offsite sync. Reassess if S/NC adds a second Proxmox host.
- **Storage endpoint:** `storage.s-nc.org` — Caddy reverse proxy to Garage S3 API on port 3900.
- **Single bucket `snc-storage`** with key prefixes (`content/`, `vod/`, `assets/`) — avoids data duplication when publishing stream recordings as content, simplifies cross-domain reads for auto-content playback on idle streams.
- **Upload size limit:** 10GB per file — Seafile handles truly massive studio sessions via desktop sync.
- **VOD pipeline integration** — Owncast `STREAM_STOPPED` webhook triggers a recording capture service that writes to `vod/` prefix in `snc-storage`. Details TBD in VOD pipeline design.
- **Start with presigned URLs** — tus upgrade path via `tus-node-server` if upload reliability on bad connections becomes an issue.

Deployment guide: see the Garage deployment design doc in the parent monorepo (`boards/platform/release-0.1/design/garage-deploy.md`).

---

## References

- [Garage](https://garagehq.deuxfleurs.fr/) — S3-compatible object storage for self-hosting
- [Garage S3 compatibility](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/) — supported operations
- [Garage on GitHub](https://github.com/deuxfleurs-org/garage) — AGPL-3.0, mirror (primary at git.deuxfleurs.fr)
- [SeaweedFS](https://github.com/seaweedfs/seaweedfs) — distributed storage, Apache 2.0
- [RustFS](https://github.com/rustfs/rustfs) — S3-compatible storage in Rust, Apache 2.0
- [Ceph RGW](https://docs.ceph.com/en/reef/radosgw/) — enterprise S3 gateway
- [MinIO archival context](https://news.reading.sh/2026/02/14/how-minio-went-from-open-source-darling-to-cautionary-tale/) — why MinIO CE is no longer viable
- [Self-Hosted S3 Storage in 2026 (Rilavek)](https://rilavek.com/resources/self-hosted-s3-compatible-object-storage-2026) — comparative guide
- [Uppy](https://uppy.io/) — modular file uploader, MIT
- [Uppy S3 plugin](https://uppy.io/docs/aws-s3/) — multipart upload documentation
- [Uppy comparison](https://uppy.io/docs/comparison/) — vs. other upload libraries
- [SVAR React File Manager](https://svar.dev/react/filemanager/) — file browser component, MIT
- [FilePond](https://pqina.nl/filepond/) — lightweight upload library, MIT
- [tus protocol](https://tus.io/) — open resumable upload standard
- [tus-node-server](https://github.com/tus/tus-node-server) — Node.js tus server with S3 backend
- [S/NC collaboration suite](../../research/collaboration-suite.md) — Seafile deployment and status
- [S/NC streaming infrastructure](streaming-infrastructure.md) — Owncast/Restreamer and VOD pipeline

*Last updated: 2026-03-13*
