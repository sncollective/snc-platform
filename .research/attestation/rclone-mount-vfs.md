---
source_handle: rclone-mount-vfs
fetched: 2026-06-23
source_url: https://rclone.org/commands/rclone_mount/
provenance: source-direct
---

## Summary

`rclone mount` exposes cloud/object storage as a FUSE filesystem. Four VFS cache modes control how reads and writes interact with the remote. `--vfs-cache-mode full` is the mode required for media editing workflows.

## Key passages

**Core mechanism:** rclone mount transforms cloud storage objects into a disk-like filing system using FUSE on Linux (native), macOS (macFUSE or FUSE-T), and Windows (WinFsp).

**VFS cache modes:**

| Mode | Behavior | Media workflow suitability |
|---|---|---|
| `off` (default) | Reads/writes go directly to remote; no local cache | Not suitable — seeking fails; simultaneous read+write fails |
| `minimal` | Write+read/write files buffered; read-only still direct | Not suitable for NLE workflows |
| `writes` | Read-only files stream direct; write+read/write buffered to disk | Partial — writes work but read-heavy seeking may be slow |
| `full` | All reads and writes buffered to local disk; sparse files | Required for media editing — enables all normal FS operations |

**Full mode behavior:**
> "All reads and writes are buffered to and from disk." Files in cache appear as sparse files, with rclone tracking downloaded segments. Reads ahead by `--buffer-size` plus `--vfs-read-ahead` bytes.

**Without caching:**
> "many applications won't work with their files on an rclone mount"

This is the documentation's own characterization of the `off` mode's limits — the strong recommendation for media workflows is `--vfs-cache-mode full`.

**NFS mounts without caching become read-only** — the documentation notes this as a caveat.

**Single-instance constraint:** Do not run multiple rclone instances sharing the same VFS cache with overlapping remotes — cache corruption risk.

## Structural metadata

- Type: tool documentation
- Scope: rclone mount VFS caching
- Format: rclone.org documentation page
