---
id: platform-0002
title: Garage as S3-compatible object storage, alongside Seafile
status: active
created: 2026-03-13
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "Garage development stalls or Deuxfleurs loses nonprofit funding (EU grant pipeline dries up without replacement)"
  - "RustFS reaches stable release with distributed mode and production usage — a clean MinIO successor under Apache 2.0"
  - "S/NC's storage needs grow to scales Garage wasn't designed for (billions of files, multi-TB hot data, need for erasure coding to reduce storage overhead)"
  - "Need for object versioning, object lock, IAM/OIDC integration, or other Garage-missing S3 features becomes load-bearing for a platform feature"
  - "Studio internet situation improves significantly (wired / higher upload speeds) — Seafile's block-level dedup advantage shrinks and a single Garage + rclone setup becomes viable, collapsing the two-system architecture"
---

## Context

S/NC needs an S3-compatible object storage layer for platform content (user avatars, media attachments, assets uploaded through the web UI), streaming VOD recordings (SRS DVR landing zone), and any future service that speaks S3 (Mastodon media, Matrix attachments, game asset CDN). Seafile handles desktop sync for studio sessions (block-level dedup on slow wifi) but is not an API-first object store — it won't serve the platform's upload, VOD, or service-backend needs.

Two forces shaped the timing. First, MinIO — the default self-hosted S3 answer for years — transitioned from Apache 2.0 to AGPL v3 in 2021, stripped the admin console from Community Edition in early 2025, and archived its GitHub repository in February 2026. MinIO CE is now a frozen codebase with no maintenance. The "just use MinIO" era is over. Second, Phase 3+ streaming requires a VOD landing zone that a single-channel Owncast could not provide natively; the platform needs S3 now as a prerequisite for the SRS-backed VOD pipeline (see [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md)).

## Alternatives considered

### Garage (selected)

See Decision below.

### SeaweedFS

**Why considered.** Apache 2.0 (permissive, unlike Garage's AGPL). Large community (~30.9k stars vs Garage's 2.8k). Erasure coding for warm/cold data (more storage-efficient than Garage's 3x replication overhead). Memory-efficient (~512MB RAM). Cloud tiering (async replication to AWS/GCS/Azure).

**Why rejected.** More complex architecture (master server + volume servers + filer + S3 gateway = multiple components to operate). Weaker governance than Garage — solo primary maintainer (bus factor), open-core model where enterprise features (encryption at rest, advanced replication) are proprietary, no foundation backing. UI maturity weaker than old MinIO's console. For S/NC's scale (modest hardware, small team), SeaweedFS's distributed-storage architecture is more than needed, and the solo-maintainer governance risk is unfavorable.

**Would change our mind if.** S/NC's storage needs grow to a scale where erasure coding's efficiency matters, or the Apache 2.0 license becomes load-bearing for a specific integration.

### RustFS

**Why considered.** Rust (matches SRS's performance character). Apache 2.0. Built-in web management console (unlike Garage). Positions itself as the MinIO successor. Project-reported 2.3x faster than MinIO for small object payloads.

**Why rejected.** Alpha status (v1.0.0-alpha as of early 2026). Distributed mode not officially released. Performance claims unverified. New project without established governance structure. Too young to trust with production data.

**Would change our mind if.** RustFS reaches stable release with distributed mode and gains production users — at that point it becomes a strong candidate as a clean MinIO successor under Apache 2.0.

### Ceph RGW

**Why considered.** Mature, foundation-backed, widely deployed at scale. S3-compatible.

**Why rejected.** Minimum 3 nodes, each wanting 16+ GB RAM and dedicated storage. 10 GbE networking minimum. Operational complexity far exceeds S/NC's needs. Ceph is a distributed storage platform, not an S3 endpoint. Designed for petabyte-scale enterprise deployments.

**Would change our mind if.** S/NC scales to operating dedicated storage infrastructure across multiple servers. Not foreseeable.

### MinIO (Community Edition)

**Why considered.** Historical default. Large community. Mature S3 compatibility.

**Why rejected.** GitHub repository archived February 2026. Admin console stripped in early 2025. AGPL v3 since 2021. Frozen codebase with no maintenance, no security patches, no UI. Running MinIO CE is borrowed time.

**Would change our mind if.** The codebase unarchives with renewed maintenance — unlikely given the commercial pivot to AIStor.

## Decision

**Garage (AGPL-3.0, Rust, ~2.8k GitHub stars, developed by Deuxfleurs)** is the S3-compatible object storage layer for S/NC, running **alongside Seafile** (not replacing it). Garage handles platform uploads, streaming VOD landing, and service backends. Seafile stays for studio desktop sync because its block-level dedup is load-bearing on slow wifi connections that characterize the primary studio's current network.

Primary reasons for Garage:

1. **Governance** — Developed by Deuxfleurs, a French nonprofit for self-hosting infrastructure. Funded through EU programs (NGI POINTER, NLnet/NGI0 Entrust, NLnet/NGI0 Commons Fund through 2025). Nonprofit-backed, publicly funded, no corporate pivot risk. The strongest governance story of any evaluated option.
2. **Operational simplicity** — Single dependency-free binary. No external database, no JVM, no runtime. 1GB RAM minimum. Runs in a Proxmox LXC container alongside everything else. No multi-component architecture to manage.
3. **S3 compatibility sufficient for our needs** — Multipart upload, presigned URLs, signature v4, bucket CRUD, ListObjects/V2, CopyObject, all core operations. Works with standard `@aws-sdk/client-s3`.
4. **Scale fit** — Designed for small self-hosted deployments on heterogeneous hardware, not enterprise data centers. That's exactly what S/NC is.

Two-system architecture (Garage alongside Seafile) resolves the "Web-based large file upload" gap in Seafile's web portal while preserving Seafile's dedup advantage for studio sync. Clean audience split: studio team uses Seafile desktop client; platform users use Garage via the web UI; services (SRS VOD, Mastodon, Matrix if adopted) use Garage via S3 API. No bridge, no sync between the two — different audiences, clean boundary.

## Consequences

**Enabled:**
- Platform upload pipeline (user avatars, media attachments, content assets) via S3 multipart + presigned URLs
- SRS DVR VOD landing zone (FLV writes → media-pipeline remux job → MP4 faststart in Garage)
- Service backends for any future S3-speaking integration (Mastodon media, Matrix attachments, game asset CDN)
- Web-based large file upload via Uppy + `@uppy/aws-s3` that outperforms Seafile's web portal for multi-GB uploads

**Adjacent implementation choices made alongside Garage:**
- **Upload pattern:** Presigned URLs (direct-to-Garage) for large files (>50MB), API proxy for small files (avatars, thumbnails). Tus protocol (`tus-node-server`) is an upgrade path if upload reliability on bad connections becomes load-bearing.
- **Upload UI library:** Uppy (MIT, modular, `@uppy/aws-s3` plugin with batch presigned URL support, `@uppy/react` wrapper for TanStack Start). The only open-source library with native S3 multipart + presigned URL + tus support.
- **File browser UI:** SVAR React File Manager (MIT, React 18/19) — list/grid/split views, breadcrumbs, context menus, keyboard shortcuts, drag & drop. Backend-agnostic; wires to the Hono API which talks to Garage via S3 SDK.
- **Deployment:** Single-node mode initially (no 3x replication overhead; back up via Proxmox snapshots + rclone offsite). Reassess if S/NC adds a second Proxmox host.
- **Storage endpoint:** `storage.s-nc.org` via Caddy reverse proxy to Garage S3 API on port 3900.
- **Bucket structure:** Single bucket `snc-storage` with key prefixes (`content/`, `vod/`, `assets/`). Avoids data duplication when publishing stream recordings as content; simplifies cross-domain reads.
- **Upload size limit:** 10 GB per file. Seafile handles larger studio sessions via desktop sync.

**Accepted trade-offs:**
- 3x storage overhead from replication at multi-node scale (single-node mode avoids this; accepted at S/NC's data volumes).
- No web admin UI — CLI administration via the `garage` command. Fine for a small team.
- AGPL-3.0 license — interacting via S3 API from the platform is fine (API boundary). Modifications to Garage itself (if we ever made them) would need to be published. We don't plan to modify Garage.
- Garage-missing S3 features: versioning, object lock, ACLs/policies, tagging, notifications. Garage uses its own per-key-per-bucket permission model. None of these are load-bearing for current platform features.
- Smaller community than SeaweedFS (2.8k vs 30.9k stars) — offset by nonprofit stability and a simpler architecture that requires less community support for operations.

**Two-system coexistence cost:**
- No file-level interop between Garage and Seafile — files in one don't appear in the other. Accepted as the right tradeoff; audiences are different.
- Two systems to keep running. Garage is genuinely low-touch; Seafile is already running.

## Related

- [../../research/object-storage.md](../../research/object-storage.md) — full evaluation of Garage vs SeaweedFS vs RustFS vs Ceph RGW vs MinIO, upload pattern comparison (presigned vs tus vs proxy), upload UI library comparison (Uppy vs FilePond vs Dropzone), Seafile coexistence analysis, integration effort estimate
- [../../research/collaboration-suite.md](../../research/collaboration-suite.md) — Seafile deployment and status (cross-submodule link; this doc may not be available when platform is cloned standalone)
- [../../research/streaming-infrastructure.md](../../research/streaming-infrastructure.md) — VOD pipeline integration points
- [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) — SRS as streaming server; Garage is the VOD landing zone for SRS DVR recordings
- Garage deployment design — in the parent monorepo under `boards/platform/release-0.1/design/garage-deploy.md` (prose reference to preserve standalone cloning)
- S3 storage presigned uploads design — in the parent monorepo under `boards/platform/release-0.1/design/s3-storage-presigned-uploads.md` (prose reference)

No prior decision record to supersede — this is a fresh promotion from research to a structured decision record as Item 3b of the Level 3 critical path (2026-04-16). No position change from the 2026-03-13 research conclusions — the decision has been load-bearing for platform work throughout that window.
