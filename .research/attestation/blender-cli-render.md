---
source_handle: blender-cli-render
fetched: 2026-06-23
source_url: https://docs.blender.org/manual/en/latest/advanced/command_line/render.html
provenance: source-direct
---

## Summary

Blender supports headless/background rendering via the `-b` (background) and `-a` / `--render-anim` flags. Media paths in `.blend` files must be accessible from the filesystem at render time — Blender uses local/mounted paths, not HTTP URLs.

## Key passages

**Background mode flag:** `-b` or `--background` — runs Blender without a GUI.

**Animation render flag:** `-a` or `--render-anim` — renders all frames from start to end.

**Critical argument order note:**
Arguments are processed in order. The blend file must be loaded before render flags take effect. Correct: `blender --background file.blend --render-output /tmp --render-frame 1`. Incorrect: `blender -b -a file.blend` (the `-a` fires before the file loads).

**Path syntax:** Blender uses `//` as a relative-path prefix that resolves relative to the `.blend` file's directory. Absolute paths and network-mounted paths (NFS/SMB/rclone, visible to the OS as a directory) also work.

**Network rendering pattern (from search results corroborating the documentation):**
For render farms, the standard approach is a shared folder mounted at the same path on all nodes (NAS via NFS or SMB). Blender sees the mount as a local path — it does not natively fetch media over HTTP. Blend files and their referenced media must be accessible as filesystem paths.

**Headless operation:** Confirmed supported. Blender render nodes on Linux run without X11 (the `-b` flag suppresses the GUI entirely).

## Structural metadata

- Type: official documentation
- Scope: Blender command-line rendering
- Format: Blender manual
