---
source_handle: rclone-mount-docs
fetched: 2026-06-23
source_url: https://rclone.org/commands/rclone_mount/
provenance: source-direct
---

# Attestation: rclone mount command documentation

## Paraphrased summary

The rclone mount documentation confirms that rclone supports mounting remote storage (including S3) as a local FUSE filesystem on Linux, FreeBSD, macOS, and Windows. Platform-specific dependencies: Windows requires WinFsp, macOS requires macFUSE or FUSE-T, Linux may need AppArmor adjustments.

Random-access read of video files has significant constraints in the default (off) VFS cache mode. The documentation states: "Without the use of `--vfs-cache-mode` this can only write files sequentially, it can only seek when reading." For video editing workflows requiring random access, `--vfs-cache-mode writes` or `--vfs-cache-mode full` is necessary:

- **Off mode (default)**: Read-only seeking works in principle but writes are sequential. Unsuitable for video editing without caching.
- **Writes mode**: Files opened read-only are read directly from remote; write/read-write files are buffered to disk first. Provides retry protection.
- **Full mode**: All reads AND writes buffer to disk. Supports sparse files. Optimal for simultaneous read/write but requires sparse-file-capable filesystem (FAT/exFAT not supported).

For video editing via rclone mount (presenting S3 as a local drive to Resolve), `--vfs-cache-mode full` is the recommended path, with the trade-off that files cache to local disk first.

## Key passages

> "Linux, FreeBSD, macOS and Windows" — supported operating systems for rclone mount.

> "Without the use of `--vfs-cache-mode` this can only write files sequentially, it can only seek when reading."

> "Full Mode: All reads and writes buffer to disk, supporting sparse file operations."

> Windows needs WinFsp, macOS supports macFUSE or FUSE-T.

## Structural metadata

- Source type: Official rclone project documentation
- Subject: rclone mount command, VFS cache modes, OS support
- Relevance: rclone mount presents S3 (Garage-compatible) as a local FUSE path, the access pattern DaVinci Resolve would use since it cannot open HTTP URLs as media sources
- Key caveat: full VFS cache mode copies files to local disk before access — this affects storage and latency for large video files
