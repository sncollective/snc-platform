---
source_handle: garage-overview
fetched: 2026-06-24
source_url: https://garagehq.deuxfleurs.fr/
provenance: source-direct
---

# Garage S3 Object Store — Overview

## Paraphrased Summary

Garage is a self-hosted, S3-compatible object store designed for distributed deployment on commodity hardware. It is the S3 backend used in the S/NC platform stack.

## What It Is

"An S3 object store so reliable you can run it outside datacenters." Implements the Amazon S3 API, compatible with existing S3 applications without vendor lock-in.

## Architecture

- **Replication:** Each data chunk replicated across 3 zones for redundancy
- **Design:** Single, dependency-free binary; lightweight; designed for distributed deployment across multiple datacenters
- **Foundation:** Built on research from Dynamo, Conflict-Free Replicated Data Types (CRDTs), and Maglev

## System Requirements

- CPU: x86_64 (last 10 years) or ARM
- RAM: 1 GB minimum
- Disk: 16 GB minimum
- Network: 200ms latency or less, 50 Mbps minimum
- Supports heterogeneous/secondhand machines

## Primary Use Cases

1. Website hosting
2. **Media storage**
3. Backup targets

## Compatible Applications

Nextcloud, Matrix, Cyberduck, Mastodon, Rclone, and PeerTube integrate natively via S3 API — PeerTube's presence confirms video platform use cases.

## Cost Model

Self-hosted, so cost is infrastructure (hardware + power + bandwidth) rather than per-GB object storage pricing. No documented per-GB pricing. Cost is dominated by bandwidth (egress) and disk capacity.

## Key Passage

> "An S3 object store so reliable you can run it outside datacenters" — designed for commodity/secondhand hardware, low resource requirements.
