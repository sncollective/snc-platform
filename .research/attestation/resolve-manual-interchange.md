---
source_handle: resolve-manual-interchange
fetched: 2026-06-23
source_url: https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1411.htm
provenance: source-direct
---

# DaVinci Resolve 18.6 Reference Manual — timeline interchange (import/export)

**Provenance note:** the DaVinci Resolve 18.6 Reference Manual, mirrored as HTML at
steakunderwater.com (VFXPedia). The authoritative original is Blackmagic's register-to-download
PDF, which was not reachable during this engagement; this mirror reproduces the manual's
interchange chapters. Two pages anchor this attestation: the OTIO/timeline **import** page
(`…/part1411.htm`) and the timeline **export** page (`…/part4003.htm`).

## Key passages

### Import (part1411.htm)
- Menu path: "From any page, choose File > Import Timeline (Shift-Command-I)", or "Open the Edit
  page, right-click anywhere in the Media Pool, and choose Timelines > Import >
  **AAF/EDL/XML/DRT/ADL/OTIO**." → Resolve imports AAF, EDL, XML, DRT, ADL, and OTIO.
- OTIO import formats: "`.otio`: These files contain just the metadata about the timeline and no
  associated media." and "`.otioz`: These bundle files contain both the Timeline metadata and all
  of the Timeline's media assets zipped together."
- Media linking on import: referenced media can be auto-imported or manually relinked to different
  formats/resolutions. Preservation of effects/transitions/markers on import: not stated on this
  page.

### Export (part4003.htm)
- Export formats listed: "Export/Import an OpenTimelineIO file (`.otio`, `.otioz`)"; "Exporting to
  AAF/XML"; EDL (standard and "Missing Clips" variants); CDL; ALE (with and without CDL); a
  CSV/TXT edit index. (FCP 7 XML / FCPXML are referenced elsewhere as XML variants; not separately
  enumerated on this page.)
- Markers: the page's contents include a section titled "Exporting Timeline Markers to EDL" — so
  timeline markers export to EDL. The detailed mechanics / full round-trip fidelity were not
  extracted from this excerpt.

## Derived (source-attestable)
Resolve reads and writes the **OTIO** interchange format **natively** — no third-party adapter is
required on the Resolve side. (This reconciles the two earlier signals in this campaign: OTIO's
ecosystem lists Resolve as an integration, while the OTIO Python *adapter* package ships no
Resolve adapter — because Resolve speaks OTIO directly.)

## Structural metadata
Reference Manual chapters, HTML-mirrored. Import chapter (part1411) covers Import Timeline +
OTIO + AAF/EDL/XML/DRT/ADL. Export chapter (part4003) enumerates the export interchange set and
references marker-to-EDL export. Companion pages exist for AAF export (part4006), EDL export
(part4007), and OTIO export (part4004).
