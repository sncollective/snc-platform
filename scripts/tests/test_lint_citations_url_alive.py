#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""SSRF-fence tests for the vendored ARD v0.4.1 citation lint `url_alive`.

Targets `ard-kernel/lint-citations.py` (the vendored verbatim reference that
`scripts/lint-citations.py` now shims to, per platform-0014). Zero-dependency
stdlib unittest — no pytest, no network. The security-critical guard
(`_url_allowed` / `_host_is_public`) is deterministic offline for literal-IP and
bad-scheme hosts: `getaddrinfo` on a numeric host does not hit DNS, so every
case below resolves without a network call. The happy-path 200 response and
live redirect-following are integration concerns (need a local mock server) and
are intentionally out of this offline unit set.

Run: python3 scripts/tests/test_lint_citations_url_alive.py
"""

import importlib.util
import os
import unittest

# The script filename is hyphenated, so import it by path rather than `import`.
# Target the vendored reference directly (the shim at scripts/ runpy-execs it as
# __main__, so it is not importable for its helpers).
_SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "ard-kernel", "lint-citations.py")
_spec = importlib.util.spec_from_file_location("lint_citations", _SCRIPT)
lint = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lint)


class UrlAllowedGuard(unittest.TestCase):
    """`_url_allowed` is the gate run before any connect — the SSRF fence."""

    def test_non_http_schemes_refused(self):
        for url in ("file:///etc/passwd", "gopher://h/x", "ftp://h/x", "data:text/plain,x"):
            self.assertFalse(lint._url_allowed(url), url)

    def test_cloud_metadata_endpoint_refused(self):
        # The canonical SSRF target — link-local.
        self.assertFalse(lint._url_allowed("http://169.254.169.254/latest/meta-data/"))

    def test_loopback_refused(self):
        self.assertFalse(lint._url_allowed("http://127.0.0.1/"))
        self.assertFalse(lint._url_allowed("http://[::1]/"))

    def test_private_ranges_refused(self):
        for url in ("http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/"):
            self.assertFalse(lint._url_allowed(url), url)

    def test_unspecified_refused(self):
        self.assertFalse(lint._url_allowed("http://0.0.0.0/"))

    def test_missing_host_refused(self):
        self.assertFalse(lint._url_allowed("http://"))

    def test_public_literal_ip_allowed(self):
        # Public literal IPs pass the gate (offline — numeric host, no DNS).
        for url in ("http://8.8.8.8/", "https://1.1.1.1/path"):
            self.assertTrue(lint._url_allowed(url), url)


class HostIsPublic(unittest.TestCase):
    def test_mixed_resolution_refused_when_any_private(self):
        # A literal private address must fail even via _host_is_public directly.
        self.assertFalse(lint._host_is_public("169.254.169.254"))
        self.assertFalse(lint._host_is_public("127.0.0.1"))

    def test_public_literal_passes(self):
        self.assertTrue(lint._host_is_public("8.8.8.8"))


class UrlAliveRefusesWithoutConnecting(unittest.TestCase):
    """A guard failure short-circuits to False before any socket is opened."""

    def test_refused_scheme_is_false(self):
        self.assertFalse(lint.url_alive("file:///etc/passwd"))

    def test_internal_target_is_false(self):
        # Guard fails first → returns False offline, no connection attempted.
        self.assertFalse(lint.url_alive("http://169.254.169.254/latest/meta-data/"))
        self.assertFalse(lint.url_alive("http://127.0.0.1:1/"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
