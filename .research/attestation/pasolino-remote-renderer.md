---
source_handle: pasolino-remote-renderer
fetched: 2026-06-23
source_url: https://github.com/OfficineDigitali/pasolino
provenance: source-direct
---

## Summary

Pasolino is a PHP/Laravel web interface for the `melt` CLI that enables remote rendering of Kdenlive MLT XML projects on a dedicated render machine. It demonstrates the feasibility of a web-managed `melt` render service.

## Key passages

**What it is:**
> "A web interface for the _melt_ command line application, from the MLT Framework, capable to render files generated with the video editor Kdenlive."

**Primary goal:**
> "The aim of the project is to move the resources-hungry rendering process to a dedicated computer, so operators can continue their post-production work without getting their own machines stuck on the final phase."

**File access strategies documented (two options):**
1. **Shared network storage:** Files stored on SMB, NFS, or similar network shares mounted identically on both machines, preserving consistent file paths.
2. **SSH-based file fetching:** A dedicated user with SSH public key auth. The application retrieves files from the operator's machine and modifies the `.mlt` project file before rendering.

**Technical stack:** PHP (97.3%), JavaScript (2.2%). Requires MySQL/RDBMS, Apache, Kdenlive, and BeanStalk queue management.

**Maintenance status:** Repository explicitly warns "THIS PROJECT IS STILL UNDER HEAVY DEVELOPMENT" with only one commit recorded and no releases. Early/inactive development.

**What it demonstrates for this engagement:**
Pasolino confirms the pattern of a web-managed `melt` render queue is architecturally feasible. It also documents that the two clean file-access approaches are (a) shared-mount identical paths and (b) SSH-pull + MLT XML modification before render. The Node.js/pg-boss platform could implement a similar pattern more cleanly using its existing job queue.

## Structural metadata

- Type: open-source project README
- Scope: web UI for remote melt rendering
- Format: GitHub repository
