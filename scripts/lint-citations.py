#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Entrypoint shim -> the vendored ARD v0.4.1 reference citation-chain lint.
#
# Per platform-0014, platform consumes ARD's citation-chain lint as the vendored
# verbatim reference at ard-kernel/lint-citations.py (which data-sources its
# pattern-category + chain-status sets from ard-kernel/catalogs.json, falling
# back to built-ins if absent) rather than a hand-maintained fork. This shim
# preserves the scripts/lint-citations.py entrypoint that the research skills,
# agents, and any CI invoke, while keeping a single source of truth in
# ard-kernel/. It supersedes the prior in-tree fork, including the hand-applied
# v0.4.1 SSRF hardening of url_alive — the reference already carries it.
#
# Delegation is via runpy so the reference runs as __main__ with its own
# __file__ (ard-kernel/lint-citations.py); its --catalogs default therefore
# resolves to ard-kernel/catalogs.json. sys.argv passes through unchanged.
import os
import runpy

_REFERENCE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), os.pardir, "ard-kernel", "lint-citations.py"
)

runpy.run_path(_REFERENCE, run_name="__main__")
