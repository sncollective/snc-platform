---
id: idea-boardgame-scribus-lane-reuse
created: 2026-09-04
updated: 2026-09-04
tags: [press]
---

Board-game production flow (operator, runs outside platform today): a
spreadsheet of cards is mail-merged into a Scribus template via
scribus-generator, then the Python Scripter surface programmatically
outputs print-and-play PDFs and Tabletop Simulator card-deck PNGs.

Operator interest (2026-09-04): machinery built for the press-kit template
integration lane could serve this flow too. Structural rhymes with the
platform press lane: content-as-data (spreadsheet ↔ PressContent),
data-merge into a designer template (generator ↔ template render),
designer artifact as source of truth (SLA template ↔ designer-regime
IDML), multi-target render with per-target geometry (PnP PDF + TTS deck
sheets ↔ print/web twins + per-slot image specs), text-fitting capacity
(card text ↔ variant capacity contracts). scribus-mcp (Scripter over MCP)
is of direct interest to the operator's lane independently of platform.

Where the reuse constraint actually landed: the template package artifact
contract + content-field schema mapping stay domain-neutral (a card-deck
content model must fit without PressContent assumptions) — recorded in
docs/scribus-bridge-and-finisher.md. Parked per operator: outside
platform's realm at the moment.
