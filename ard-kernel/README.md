<!-- ARD-Version: 0.4.1 -->
# ARD kernel

The **vendorable reference surface of ARD** (the Agentic Research Discipline) — the cross-harness artifacts an adopter copies **as-is**, regardless of agent system. These are **reference implementations subordinate to the specification, not the framework itself**: [SPEC.md](https://code.s-nc.org/Kevoun/ARD) (cited here as *ARD SPEC §N*) names the invariants; the artifacts here are runnable renderings of them. The one contract they assume is the `[handle]{N}` citation wire-form + the normative-minimum attestation frontmatter (*ARD SPEC §4.2*). Honor that and everything here runs against your deployment unchanged.

This directory is **self-contained and liftable** — copy `kernel/` into your own repository as-is. It cites ARD's framework surfaces (the **specification** and **baseline catalogs**) **by name and section number** (e.g. *ARD SPEC §4.2*, *ARD CATALOGS §3*) rather than by file path, so nothing dangles when it stands alone. For `SPEC` and `CATALOGS` themselves, see the [ARD project](https://code.s-nc.org/Kevoun/ARD).

## Contents

Each entry carries a **vendor-mode** (see [`ard.json`](https://code.s-nc.org/Kevoun/ARD)): `verbatim` = copy unaltered; `data` = consume as structured data; `verify` = run to validate your copy.

| File | Mode | What it is |
|---|---|---|
| [discipline.md](discipline.md) | verbatim | The anti-fabrication discipline bundle (*ARD SPEC §4–5*) — the content that must travel **unaltered** into every research-authoring sub-context. Copy it into your propagation mechanism; do not re-narrate it (the drift fence, *ARD SPEC §4.6*). |
| [lint-citations.py](lint-citations.py) | verbatim | Zero-dependency reference implementation of the verification stack's always-on mechanical floor (*ARD SPEC §7*): citation-chain integrity (5 checks + 2 non-broken statuses), the 6 surface-signature pattern categories (*ARD CATALOGS §3*), and the GR.5 thin-attestation structural check. Reads its category/status sets from `catalogs.json`; falls back to built-ins if absent. The contract it assumes is *ARD SPEC §4.2*. |
| [templates/](templates/) | verbatim | Fill-in artifact skeletons — `attestation.md` (the normative-minimum frontmatter, *ARD SPEC §4.2*), `dispatch.md` (the registration contract, *ARD SPEC §9*), `precis.md`, per-corpus `INDEX.md`. |
| [schema/](schema/) | verbatim | Data-contract JSON schemas — `attestation.schema.json` (the normative-minimum attestation frontmatter). |
| [catalogs.json](catalogs.json) | data | Generated catalog members (failure-shapes, source-classes, lint categories, decision-points, registration enums, statuses, provenance values) — projected from `CATALOGS.md` by `tools/gen-contract.py`. Consume as data; re-sync on a MINOR bump. |
| [conformance/](conformance/) | verify | Golden fixtures + a runner (`run.py`) that validate a vendored or ported lint against ARD's canonical verdicts — all 7 chain statuses + thin + the 6 pattern categories. |

## Running the lint

```
python3 lint-citations.py <brief-or-dir> --attestation-dir <your-attestation-tier>
```

Resolves every `[handle]{N}` to `<attestation-dir>/<handle>.md`, runs the five citation-chain checks (`resolved` / `unresolved-handle` / `mismatched-source-handle` / `unreachable-source` / `missing-provenance`, plus the non-broken `intra-program-resolved` and `reduced-substrate-attestation`), applies the GR.5 thin-attestation check to each resolved attestation, scans prose for the six pattern categories, and reports per-citation status (Markdown or `--format json`). `source_url` liveness is HEAD-checked by default (warn-level; `--no-url-check` to skip) — the probe is fenced to public http(s) targets (non-http schemes and loopback / link-local / private / reserved hosts are refused and report as `unreachable-source`, and each redirect hop is re-validated), so a hostile attestation can't aim the linter at an internal address; `--exit-code-on high` opts into blocking. Default posture is lint-only-warn.

## Vendoring + drift checks

Pin a [release tag](https://code.s-nc.org/Kevoun/ARD) (e.g. `v0.4.1`) — its canonical version is in [`ard.json`](https://code.s-nc.org/Kevoun/ARD) — and copy this directory. Every kernel file also carries an `ARD-Version:` stamp; your drift check against upstream is:

```
grep -r ARD-Version kernel/
```

A MINOR/inventory bump (new failure-shape, source-class, lint *matcher*) leaves the assumed contract unchanged — only the `[handle]{N}` wire-form + the normative-minimum attestation frontmatter (*ARD SPEC §4.2*) are architecture, and they move only on a MAJOR bump. See `VERSIONING.md` at the [ARD project](https://code.s-nc.org/Kevoun/ARD) root.

## Kernel vs. example

The kernel is **what everyone takes**. The worked `example/` (in the [ARD project](https://code.s-nc.org/Kevoun/ARD), alongside this kernel) is **one illustration** — a Claude-agent-system deployment (orchestrator, discipline-propagation, verification sub-agents) wired *around* this kernel. A non-Claude adopter (Codex, Pi, Cursor, a local model) vendors `kernel/` and **skips** `example/`, reading it only for reference. The full adoption path is `ADOPTING.md` at the [ARD project](https://code.s-nc.org/Kevoun/ARD).
