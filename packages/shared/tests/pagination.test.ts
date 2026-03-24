import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  createPaginationQuery,
  type PaginationQuery,
} from "../src/index.js";

describe("createPaginationQuery", () => {
  describe("with default options", () => {
    const schema = createPaginationQuery();

    it("applies default max of 50 and default limit of 20", () => {
      const result = schema.parse({});
      expect(result.limit).toBe(20);
    });

    it("rejects limit above default max (50)", () => {
      expect(() => schema.parse({ limit: 51 })).toThrow();
    });

    it("accepts limit at max boundary (50)", () => {
      const result = schema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });
  });

  describe("with custom options", () => {
    const schema = createPaginationQuery({ max: 100, default: 50 });

    it("applies custom default limit", () => {
      const result = schema.parse({});
      expect(result.limit).toBe(50);
    });

    it("accepts limit at custom max boundary", () => {
      const result = schema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it("rejects limit above custom max", () => {
      expect(() => schema.parse({ limit: 101 })).toThrow();
    });
  });

  describe("cursor field", () => {
    const schema = createPaginationQuery();

    it("accepts cursor as optional string", () => {
      const result = schema.parse({ cursor: "abc123" });
      expect(result.cursor).toBe("abc123");
    });

    it("allows omitting cursor", () => {
      const result = schema.parse({});
      expect(result.cursor).toBeUndefined();
    });
  });

  describe("limit coercion", () => {
    const schema = createPaginationQuery({ max: 50, default: 12 });

    it("coerces string limit to number", () => {
      const result = schema.parse({ limit: "25" });
      expect(result.limit).toBe(25);
    });

    it("validates limit at minimum boundary (1)", () => {
      const result = schema.parse({ limit: 1 });
      expect(result.limit).toBe(1);
    });

    it("rejects limit below minimum (0)", () => {
      expect(() => schema.parse({ limit: 0 })).toThrow();
    });

    it("rejects non-integer limit (1.5)", () => {
      expect(() => schema.parse({ limit: 1.5 })).toThrow();
    });
  });

  describe(".extend() composition", () => {
    const schema = createPaginationQuery({ max: 50, default: 12 }).extend({
      type: z.string().optional(),
    });

    it("includes pagination fields and extended fields", () => {
      const result = schema.parse({ type: "video", limit: 10, cursor: "x" });
      expect(result.type).toBe("video");
      expect(result.limit).toBe(10);
      expect(result.cursor).toBe("x");
    });

    it("applies pagination defaults in extended schema", () => {
      const result = schema.parse({});
      expect(result.limit).toBe(12);
      expect(result.cursor).toBeUndefined();
      expect(result.type).toBeUndefined();
    });
  });

  describe(".omit() composition", () => {
    const schema = createPaginationQuery({ max: 50, default: 20 })
      .omit({ cursor: true })
      .extend({ q: z.string().optional() });

    it("omits cursor and includes extended fields", () => {
      const result = schema.parse({ q: "search", limit: 10 });
      expect(result.q).toBe("search");
      expect(result.limit).toBe(10);
      expect("cursor" in result).toBe(false);
    });
  });

  // Type-level assertion (compile-time only)
  const _paginationQueryCheck: PaginationQuery = { limit: 20 };
});
