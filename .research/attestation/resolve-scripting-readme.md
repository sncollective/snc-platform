---
source_handle: resolve-scripting-readme
fetched: 2026-06-23
source_url: https://gist.github.com/X-Raym/2f2bf453fc481b9cca624d7ca0e19de8
provenance: source-direct
---

# DaVinci Resolve scripting README

**Provenance note:** verbatim community mirror of the `README.txt` that ships inside the DaVinci
Resolve install at `Developer/Scripting/README.txt` (the gist is described as an unmodified copy
of the Blackmagic-shipped file). The authoritative original is in-app; Blackmagic's public web
copies were not reachable during this engagement. The load-bearing `-nogui` headless passage and
the "needs to be running" passage are **corroborated against a second independent mirror**
(`resolvedevdoc.readthedocs.io/en/latest/readme_resolveapi.html`, fetched 2026-06-23). The
Free/Studio "common superset" passage appears in this mirror but **not** in the readthedocs mirror
— likely version drift between README revisions; treat that passage as version-specific.

## Key passages

- **Scripting requires Resolve running:** "DaVinci Resolve needs to be running for a script to be
  invoked." (Corroborated by the second mirror.)
- **Headless mode (load-bearing):** "DaVinci Resolve can be launched in a headless mode without the
  user interface using the `-nogui` command line option. When DaVinci Resolve is launched using
  this option, the user interface is disabled. However, the various scripting APIs will continue
  to work as expected." (Corroborated by the second mirror.)
- **Local vs remote invocation:** "By default, scripts can be invoked from the Console window in
  the Fusion page, or via command line. This permission can be changed in Resolve Preferences, to
  be only from Console, or to be invoked from the local network. Please be aware of the security
  implications when allowing scripting access from outside of the Resolve application."
- **Free vs Studio (single-mirror — see provenance note):** under "Studio and AI Scripting APIs":
  "The DaVinci Resolve scripting APIs cover a common superset of functions for both the Free and
  Studio versions." And: API calls "can return with a False status (or an appropriate error
  status) when ... the function references a Studio function from the free DaVinci Resolve
  version."
- **Render via API:** the scripting API exposes render methods including `AddRenderJob()`,
  `StartRendering()`, and `LoadRenderPreset()`. The README does not separately state whether the
  GUI must remain open during a render (the `-nogui` headless statement is the relevant general
  permission).
- **Paths / env vars:** `RESOLVE_SCRIPT_API` points at the `Developer/Scripting` folder;
  `RESOLVE_SCRIPT_LIB` points at the `fusionscript` library. Platform paths — macOS:
  `/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting`; Windows:
  `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting`; Linux:
  `/opt/resolve/Developer/Scripting`.

## Structural metadata

Plain-text README, sectioned: intro (invocation + running requirement + `-nogui`), environment
variables, "Basic Resolve API" (object model: Resolve → ProjectManager → Project → Timeline;
render methods), "Studio and AI Scripting APIs" (Free/Studio boundary). Mirror is a single-page
gist; readthedocs corroborating mirror renders the same content as HTML.
