import { describe, expect, it } from "vitest";

import { PressContentSchema } from "../src/index.js";

const release = {
  slug: "the-illusionist",
  title: "The Illusionist",
  personnel: [],
  fcc: "clean" as const,
};

describe("PressContentSchema", () => {
  it.each(["", "Not A Slug", "has_underscore"])(
    "rejects invalid release slug %j",
    (slug) => {
      const result = PressContentSchema.safeParse({
        standoutTrack: null,
        releases: [{ ...release, slug }],
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects duplicate release slugs", () => {
    const result = PressContentSchema.safeParse({
      standoutTrack: null,
      releases: [release, { ...release, title: "Duplicate" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["releases"] })]),
      );
    }
  });
});
