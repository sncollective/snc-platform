import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type React from "react";

import {
  EditorialApiProvider,
  ADMIN_EDITORIAL_API,
  useEditorialApi,
} from "../../../../src/components/playout/editorial-api.js";

// The context is fail-closed by design: a mount that forgets the provider must error
// loudly rather than silently resolve to the admin scope. These tests lock that contract.
describe("useEditorialApi", () => {
  it("throws when no EditorialApiProvider wraps the consumer", () => {
    expect(() => renderHook(() => useEditorialApi())).toThrow(
      "useEditorialApi must be used within an EditorialApiProvider",
    );
  });

  it("returns the injected api bundle when wrapped", () => {
    const wrapper = ({ children }: { children: React.ReactNode }): React.ReactElement => (
      <EditorialApiProvider api={ADMIN_EDITORIAL_API}>{children}</EditorialApiProvider>
    );
    const { result } = renderHook(() => useEditorialApi(), { wrapper });
    expect(result.current).toBe(ADMIN_EDITORIAL_API);
  });
});
