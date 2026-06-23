---
source_handle: shotcut-cli-options
fetched: 2026-06-23
source_url: https://www.shotcut.org/notes/command-line-options/
provenance: source-direct
---

## Summary

Official Shotcut documentation of command-line options. Documents all supported CLI flags. Confirms that Shotcut does not expose headless rendering through its own CLI — it is a GUI application.

## Key Passages

### Available CLI Flags

All documented options are UI-oriented:

- `-h, --help` — display help
- `-v, --version` — show version
- `--fullscreen` — maximize window
- `--noupgrade` — suppress upgrade notifications
- `--glaxnimate` — launch Glaxnimate instead
- `--gpu` — enable GPU acceleration
- `--clear-recent` — erase recent files on exit
- `--appdata <directory>` — specify config/data location
- `--QT_SCALE_FACTOR`, `--QT_SCREEN_SCALE_FACTORS`, `--QT_SCALE_FACTOR_ROUNDING_POLICY` — DPI/scaling options
- `--SDL_AUDIODRIVER <string>` — select audio API

### Headless Render Finding

**No headless rendering option is documented.** The flags focus entirely on display and UI configuration. There is no `--render` or similar batch-output flag.

### Melt Integration

Not mentioned in this document. However, Shotcut's MLT XML files (`.mlt`) can be rendered directly via `melt` since Shotcut uses MLT as its engine. The connection is through the MLT layer, not through Shotcut's own CLI.

### Accepted Input

Documentation notes that Shotcut can open "MLT XML project files, generic MLT XML files, or even MLT producer specifications" in addition to media files.

## Structural Metadata

- **Latest confirmed version**: 26.4.30 (April 2026)
- **Headless render**: Not available via Shotcut CLI; available via `melt` on the underlying `.mlt` file
- **GUI dependency**: All CLI flags assume a display/GUI context
