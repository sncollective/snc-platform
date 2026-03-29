import { describe, it, expect } from "vitest";

import { ValidationError } from "@snc/shared";

import {
  encodeCursor,
  decodeRawCursor,
  decodeCursor,
  buildPaginatedResponse,
} from "../../src/lib/cursor.js";

// ── encodeCursor / decodeRawCursor ──

describe("encodeCursor", () => {
  it("encodes a record to a base64url string", () => {
    const encoded = encodeCursor({ foo: "bar", baz: "qux" });
    expect(typeof encoded).toBe("string");
    expect(encoded).not.toContain("="); // base64url has no padding
  });

  it("round-trips with decodeRawCursor", () => {
    const data = { timestamp: "2025-01-01T00:00:00.000Z", id: "abc-123" };
    const encoded = encodeCursor(data);
    const decoded = decodeRawCursor(encoded);
    expect(decoded).toStrictEqual(data);
  });
});

// ── decodeRawCursor ──

describe("decodeRawCursor", () => {
  it("decodes a valid base64url cursor to a record", () => {
    const data = { endCursor: "opaque-shopify-cursor" };
    const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
    expect(decodeRawCursor(encoded)).toStrictEqual(data);
  });

  it("throws ValidationError on malformed base64url input", () => {
    expect(() => decodeRawCursor("!!!not-valid-base64!!!")).toThrow(ValidationError);
  });

  it("throws ValidationError when decoded value is an array", () => {
    const encoded = Buffer.from(JSON.stringify(["a", "b"])).toString("base64url");
    expect(() => decodeRawCursor(encoded)).toThrow(ValidationError);
  });

  it("throws ValidationError when decoded value is null", () => {
    const encoded = Buffer.from("null").toString("base64url");
    expect(() => decodeRawCursor(encoded)).toThrow(ValidationError);
  });

  it("throws ValidationError when decoded value is a primitive string", () => {
    const encoded = Buffer.from(JSON.stringify("just-a-string")).toString("base64url");
    expect(() => decodeRawCursor(encoded)).toThrow(ValidationError);
  });
});

// ── decodeCursor ──

describe("decodeCursor", () => {
  const fields = { timestampField: "createdAt", idField: "id" };

  it("decodes a valid cursor into { timestamp, id }", () => {
    const isoDate = "2025-06-15T12:00:00.000Z";
    const data = { createdAt: isoDate, id: "user-999" };
    const encoded = encodeCursor(data);
    const decoded = decodeCursor(encoded, fields);
    expect(decoded.id).toBe("user-999");
    expect(decoded.timestamp).toBeInstanceOf(Date);
    expect(decoded.timestamp.toISOString()).toBe(isoDate);
  });

  it("throws ValidationError when the timestamp field is missing", () => {
    const encoded = encodeCursor({ id: "user-999" });
    expect(() => decodeCursor(encoded, fields)).toThrow(ValidationError);
  });

  it("throws ValidationError when the id field is missing", () => {
    const encoded = encodeCursor({ createdAt: "2025-01-01T00:00:00.000Z" });
    expect(() => decodeCursor(encoded, fields)).toThrow(ValidationError);
  });

  it("throws ValidationError when timestamp is not a valid date string", () => {
    const encoded = encodeCursor({ createdAt: "not-a-date", id: "user-1" });
    expect(() => decodeCursor(encoded, fields)).toThrow(ValidationError);
  });

  it("throws ValidationError on completely malformed base64url input", () => {
    expect(() => decodeCursor("###bad###", fields)).toThrow(ValidationError);
  });

  it("supports custom field names", () => {
    const customFields = { timestampField: "publishedAt", idField: "slug" };
    const isoDate = "2024-03-01T09:30:00.000Z";
    const encoded = encodeCursor({ publishedAt: isoDate, slug: "my-post" });
    const decoded = decodeCursor(encoded, customFields);
    expect(decoded.id).toBe("my-post");
    expect(decoded.timestamp.toISOString()).toBe(isoDate);
  });
});

// ── buildPaginatedResponse ──

describe("buildPaginatedResponse", () => {
  type Item = { createdAt: string; id: string; value: string };

  const cursorFields = (item: Item) => ({
    createdAt: item.createdAt,
    id: item.id,
  });

  const makeItems = (count: number): Item[] =>
    Array.from({ length: count }, (_, i) => ({
      createdAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      id: `item-${i + 1}`,
      value: `val-${i + 1}`,
    }));

  it("returns all items and null nextCursor when rows <= limit", () => {
    const rows = makeItems(3);
    const { items, nextCursor } = buildPaginatedResponse(rows, 5, cursorFields);
    expect(items).toHaveLength(3);
    expect(nextCursor).toBeNull();
  });

  it("returns exactly limit items and a nextCursor when rows > limit", () => {
    const rows = makeItems(6); // limit+1 = 6 rows for limit=5
    const { items, nextCursor } = buildPaginatedResponse(rows, 5, cursorFields);
    expect(items).toHaveLength(5);
    expect(nextCursor).not.toBeNull();
  });

  it("encodes the cursor from the last item in the result slice", () => {
    const rows = makeItems(4); // limit=3, extra row triggers next cursor
    const { items, nextCursor } = buildPaginatedResponse(rows, 3, cursorFields);
    expect(items).toHaveLength(3);
    const decoded = decodeRawCursor(nextCursor!);
    expect(decoded.id).toBe(items[items.length - 1]!.id);
    expect(decoded.createdAt).toBe(items[items.length - 1]!.createdAt);
  });

  it("does not mutate the input rows array", () => {
    const rows = makeItems(4);
    const originalLength = rows.length;
    buildPaginatedResponse(rows, 3, cursorFields);
    expect(rows).toHaveLength(originalLength);
  });

  it("returns empty items and null nextCursor for an empty result", () => {
    const { items, nextCursor } = buildPaginatedResponse([], 10, cursorFields);
    expect(items).toHaveLength(0);
    expect(nextCursor).toBeNull();
  });

  it("returns exactly 1 item when limit=1 and rows has 2 items", () => {
    const rows = makeItems(2);
    const { items, nextCursor } = buildPaginatedResponse(rows, 1, cursorFields);
    expect(items).toHaveLength(1);
    expect(nextCursor).not.toBeNull();
  });
});
