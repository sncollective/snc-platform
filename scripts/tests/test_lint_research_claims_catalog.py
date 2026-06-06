#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Tests for lint-research-claims.py catalog data-sourcing (platform-0014, child 4b).

Zero-dependency stdlib unittest. Verifies the lint sources its pattern-category
enumeration + non-broken citation-status set from the vendored
ard-kernel/catalogs.json, and falls back to its built-ins when the catalog is
absent — without changing flagging behavior (the matchers stay local).

Run: python3 scripts/tests/test_lint_research_claims_catalog.py
"""

import importlib.util
import json
import os
import tempfile
import unittest

_HERE = os.path.dirname(__file__)
_SCRIPT = os.path.join(_HERE, "..", "lint-research-claims.py")
_CATALOG = os.path.join(_HERE, "..", "..", "ard-kernel", "catalogs.json")
_spec = importlib.util.spec_from_file_location("lint_research_claims", _SCRIPT)
lint = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lint)


class CatalogSourcing(unittest.TestCase):
    def test_pattern_specs_keys_are_canonical_catalog_ids(self):
        """The local matchers must be keyed by the canonical catalog category ids,
        so the catalog enumeration activates them by id."""
        catalog_ids = {c["id"] for c in json.load(open(_CATALOG))["lint"]["pattern_categories"]}
        self.assertEqual(set(lint.PATTERN_SPECS), catalog_ids)

    def test_loads_categories_and_statuses_from_catalog(self):
        specs, non_broken = lint.load_catalog_config(_CATALOG)
        # Every active spec id is a canonical catalog category, and the count matches.
        catalog = json.load(open(_CATALOG))["lint"]
        self.assertEqual(set(specs), {c["id"] for c in catalog["pattern_categories"]})
        self.assertEqual(
            non_broken,
            {s["id"] for s in catalog["citation_chain_statuses"] if not s["broken"]},
        )

    def test_falls_back_when_catalog_absent(self):
        specs, non_broken = lint.load_catalog_config("/nonexistent/catalogs.json")
        self.assertEqual(specs, lint.PATTERN_SPECS)
        self.assertEqual(non_broken, lint.RESOLVED_STATUSES)

    def test_falls_back_on_malformed_catalog(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            fh.write("{ not json")
            bad = fh.name
        try:
            specs, non_broken = lint.load_catalog_config(bad)
            self.assertEqual(specs, lint.PATTERN_SPECS)
            self.assertEqual(non_broken, lint.RESOLVED_STATUSES)
        finally:
            os.unlink(bad)

    def test_non_broken_set_matches_expected(self):
        _, non_broken = lint.load_catalog_config(_CATALOG)
        self.assertEqual(
            non_broken,
            {"resolved", "intra-program-resolved", "reduced-substrate-attestation"},
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
