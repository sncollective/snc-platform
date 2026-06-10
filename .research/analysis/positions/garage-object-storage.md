---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
related:
  - to: ../briefs/object-storage.md
    type: grounds
    note: full evaluation — Garage vs SeaweedFS vs RustFS vs Ceph RGW vs MinIO, upload pattern comparison, upload UI library comparison, integration effort estimate
  - to: ../briefs/streaming-infrastructure.md
    type: cites
    note: VOD pipeline integration points
  - to: srs-streaming-server.md
    type: cites
    note: SRS as streaming server; Garage is the VOD landing zone for SRS DVR recordings
revisit_if:
  - Garage development stalls or Deuxfleurs loses nonprofit funding (EU grant pipeline dries up without replacement)
  - RustFS reaches stable release with distributed mode and production usage — a clean MinIO successor under Apache 2.0
  - S/NC's storage needs grow to scales Garage wasn't designed for (billions of files, multi-TB hot data, need for erasure coding to reduce storage overhead)
  - Need for object versioning, object lock, IAM/OIDC integration, or other Garage-missing S3 features becomes load-bearing for a platform feature
  - Studio internet situation improves significantly (wired / higher upload speeds) — Seafile's block-level dedup advantage shrinks and a single Garage + rclone setup becomes viable, collapsing the two-system architecture
---

# Position: Garage as S3-compatible object storage, alongside Seafile

**Status: settled.** Garage is the platform's S3-compatible object storage layer, running
alongside Seafile (not replacing it), selected after a full evaluation of available options.

## The stance

**Garage (AGPL-3.0, Rust, ~2.8k GitHub stars, Deuxfleurs nonprofit) is the platform's S3
object storage.** It handles platform uploads, streaming VOD landing, and service backends.
Seafile stays for studio desktop sync because its block-level dedup is load-bearing on slow
wifi connections.

### Primary reasons for Garage

1. **Governance**: Developed by Deuxfleurs, a French nonprofit for self-hosting infrastructure.
   Funded through EU programs (NGI POINTER, NLnet/NGI0 Entrust, NLnet/NGI0 Commons Fund through
   2025). Nonprofit-backed, publicly funded, no corporate pivot risk — the strongest governance
   story of any evaluated option.
2. **Operational simplicity**: Single dependency-free binary. No external database, no JVM, no
   runtime. 1 GB RAM minimum. Runs in a Proxmox LXC container. No multi-component architecture.
3. **S3 compatibility sufficient for our needs**: Multipart upload, presigned URLs, signature v4,
   bucket CRUD, ListObjects/V2, CopyObject, all core operations. Works with standard
   `@aws-sdk/client-s3`.
4. **Scale fit**: Designed for small self-hosted deployments on heterogeneous hardware. That is
   exactly what S/NC is.

Two-system architecture (Garage alongside Seafile) resolves the "web-based large file upload" gap
in Seafile's web portal while preserving Seafile's dedup advantage for studio sync. Clean audience
split: studio team uses Seafile desktop client; platform users use Garage via the web UI; services
(SRS VOD, Mastodon, Matrix if adopted) use Garage via S3 API.

## Rejected alternatives

### SeaweedFS

Apache 2.0 (permissive), large community (~30.9k stars vs Garage's 2.8k), erasure coding
for warm/cold data, memory-efficient (~512 MB RAM), cloud tiering.

**Why rejected:** More complex architecture (master server + volume servers + filer + S3 gateway =
multiple components to operate). Weaker governance — solo primary maintainer (bus factor),
open-core model where enterprise features (encryption at rest, advanced replication) are
proprietary, no foundation backing. For S/NC's scale (modest hardware, small team), SeaweedFS's
distributed-storage architecture is more than needed, and the solo-maintainer governance risk is
unfavorable.

Would reconsider if S/NC's storage needs grow to a scale where erasure coding's efficiency
matters, or if the Apache 2.0 license becomes load-bearing for a specific integration.

### RustFS

Rust (matches SRS's performance character), Apache 2.0, built-in web management console,
positions itself as the MinIO successor, project-reported 2.3× faster than MinIO for small
object payloads.

**Why rejected:** Alpha status (v1.0.0-alpha as of early 2026). Distributed mode not officially
released. Performance claims unverified. New project without established governance. Too young
to trust with production data.

Would reconsider when RustFS reaches stable release with distributed mode and production users —
at that point it becomes a strong candidate as a clean MinIO successor under Apache 2.0.

### Ceph RGW

Mature, foundation-backed, widely deployed at scale. S3-compatible.

**Why rejected:** Minimum 3 nodes, each wanting 16+ GB RAM and dedicated storage. 10 GbE
networking minimum. Operational complexity far exceeds S/NC's needs. Designed for
petabyte-scale enterprise deployments, not a small cooperative.

Would reconsider only if S/NC scales to operating dedicated storage infrastructure across
multiple servers — not foreseeable.

### MinIO (Community Edition)

Historical default. Large community. Mature S3 compatibility.

**Why rejected:** GitHub repository archived February 2026. Admin console stripped in early
2025. AGPL v3 since 2021. Frozen codebase with no maintenance, no security patches, no UI.
The "just use MinIO" era is over.

Would reconsider only if the codebase unarchives with renewed maintenance — unlikely given the
commercial pivot to AIStor.

## Adjacent choices made alongside Garage

- **Upload pattern:** Presigned URLs (direct-to-Garage) for large files (>50 MB), API proxy for
  small files (avatars, thumbnails). Tus protocol (`tus-node-server`) is an upgrade path if
  upload reliability on bad connections becomes load-bearing.
- **Upload UI library:** Uppy (MIT, modular, `@uppy/aws-s3` plugin with batch presigned URL
  support, `@uppy/react` wrapper for TanStack Start).
- **File browser UI:** SVAR React File Manager (MIT, React 18/19) — list/grid/split views,
  backend-agnostic, wires to the Hono API which talks to Garage via S3 SDK.
- **Deployment:** Single-node mode initially. Reassess if S/NC adds a second Proxmox host.
- **Storage endpoint:** `storage.s-nc.org` via Caddy reverse proxy to Garage S3 API on port 3900.
- **Bucket structure:** Single bucket `snc-storage` with key prefixes (`content/`, `vod/`,
  `assets/`). Avoids data duplication when publishing stream recordings as content.
- **Upload size limit:** 10 GB per file. Seafile handles larger studio sessions via desktop sync.

## Accepted trade-offs

- 3× storage overhead from replication at multi-node scale (single-node mode avoids this).
- No web admin UI — CLI administration via the `garage` command.
- AGPL-3.0 license — interacting via S3 API from the platform is fine (API boundary).
  Modifications to Garage itself (if we ever made them) would need to be published.
- Garage-missing S3 features: versioning, object lock, ACLs/policies, tagging, notifications.
  None are load-bearing for current platform features.
- Smaller community than SeaweedFS — offset by nonprofit stability and simpler architecture.
- Two systems (Garage + Seafile) to keep running. Garage is genuinely low-touch; Seafile is
  already running. No file-level interop between them — accepted (different audiences).

## Platform constraints it sets

- `garage-v2` tech-reference skill carries the Garage API and deployment patterns.
- VOD pipeline landing zone: SRS DVR FLV writes land in Garage after pg-boss-queued remux.
- Playout content library lives in Garage under `playout/` prefix.
