import { describe, it, expect } from "vitest";

import { extractStreamKey } from "../../src/services/stream-lifecycle.js";

// The two side-effect functions (ensureLiveChannelWithChat, teardownLiveChannel)
// are fire-and-forget orchestration covered end-to-end by the SRS on_publish /
// on_unpublish paths in tests/routes/streaming.routes.test.ts. extractStreamKey
// is a pure parser, unit-tested directly here now that it lives in a service.

describe("extractStreamKey", () => {
  it("extracts the key from a leading ?key= param", () => {
    expect(extractStreamKey("?key=pk_test_playout_key")).toBe("pk_test_playout_key");
  });

  it("extracts the key when it follows other params via &key=", () => {
    expect(extractStreamKey("?vhost=__defaultVhost__&key=fake-stream-key")).toBe(
      "fake-stream-key",
    );
  });

  it("returns null when no key param is present", () => {
    expect(extractStreamKey("?vhost=__defaultVhost__")).toBeNull();
  });

  it("returns null for an empty param string", () => {
    expect(extractStreamKey("")).toBeNull();
  });

  it("returns an empty string for an explicit empty key value", () => {
    // Matches today's behavior: `key=` with no value yields "" (a present-but-empty key),
    // distinct from a missing key (null). The route layer rejects empty keys downstream.
    expect(extractStreamKey("?key=")).toBe("");
  });
});
