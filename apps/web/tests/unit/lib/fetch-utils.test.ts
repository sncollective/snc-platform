import { describe, it, expect, vi } from "vitest";

import {
  throwIfNotOk,
  apiGet,
  apiMutate,
  apiUpload,
} from "../../../src/lib/fetch-utils.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── Helpers ──

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

function errorJson(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: { message } }), { status });
}

// ── throwIfNotOk ──

describe("throwIfNotOk", () => {
  it("does nothing for a 200 response", async () => {
    const response = new Response("ok", { status: 200 });
    await expect(throwIfNotOk(response)).resolves.toBeUndefined();
  });

  it("does nothing for a 201 response", async () => {
    const response = new Response("created", { status: 201 });
    await expect(throwIfNotOk(response)).resolves.toBeUndefined();
  });

  it("throws with error.message from JSON body", async () => {
    const response = errorJson("Validation failed", 422);
    await expect(throwIfNotOk(response)).rejects.toThrow("Validation failed");
  });

  it("falls back to statusText when body has no error.message", async () => {
    const response = new Response(JSON.stringify({ other: "data" }), {
      status: 403,
      statusText: "Forbidden",
    });
    await expect(throwIfNotOk(response)).rejects.toThrow("Forbidden");
  });

  it("falls back to statusText when body is not valid JSON", async () => {
    const response = new Response("not json", {
      status: 500,
      statusText: "Internal Server Error",
    });
    await expect(throwIfNotOk(response)).rejects.toThrow(
      "Internal Server Error",
    );
  });

  it("falls back to statusText when error.message is missing", async () => {
    const response = new Response(JSON.stringify({ error: {} }), {
      status: 400,
      statusText: "Bad Request",
    });
    await expect(throwIfNotOk(response)).rejects.toThrow("Bad Request");
  });
});

// ── apiGet ──

describe("apiGet", () => {
  it("fetches from the endpoint with credentials", async () => {
    const data = { items: [1, 2, 3] };
    getMockFetch().mockResolvedValue(okJson(data));

    const result = await apiGet<{ items: number[] }>("/api/items");

    expect(getMockFetch()).toHaveBeenCalledWith("/api/items", {
      credentials: "include",
      signal: undefined,
    });
    expect(result).toEqual(data);
  });

  it("appends query params to the URL", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));

    await apiGet("/api/items", { page: 2, limit: 10 });

    const calledUrl = getMockFetch().mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/items?");
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("limit=10");
  });

  it("omits undefined params", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));

    await apiGet("/api/items", { page: 1, cursor: undefined });

    const calledUrl = getMockFetch().mock.calls[0][0] as string;
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).not.toContain("cursor");
  });

  it("does not append query string when all params are undefined", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));

    await apiGet("/api/items", { cursor: undefined });

    const calledUrl = getMockFetch().mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/items");
  });

  it("does not append query string when params object is empty", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));

    await apiGet("/api/items", {});

    const calledUrl = getMockFetch().mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/items");
  });

  it("converts numeric params to strings", async () => {
    getMockFetch().mockResolvedValue(okJson({ items: [] }));

    await apiGet("/api/items", { count: 42 });

    const calledUrl = getMockFetch().mock.calls[0][0] as string;
    expect(calledUrl).toContain("count=42");
  });

  it("passes abort signal to fetch", async () => {
    getMockFetch().mockResolvedValue(okJson({}));
    const controller = new AbortController();

    await apiGet("/api/items", undefined, controller.signal);

    expect(getMockFetch()).toHaveBeenCalledWith("/api/items", {
      credentials: "include",
      signal: controller.signal,
    });
  });

  it("throws on non-ok response", async () => {
    getMockFetch().mockResolvedValue(errorJson("Not found", 404));

    await expect(apiGet("/api/missing")).rejects.toThrow("Not found");
  });

  it("propagates abort errors", async () => {
    const controller = new AbortController();
    controller.abort();
    getMockFetch().mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(
      apiGet("/api/items", undefined, controller.signal),
    ).rejects.toThrow("Aborted");
  });
});

// ── apiMutate ──

describe("apiMutate", () => {
  it("sends POST with JSON body by default", async () => {
    const responseData = { id: "123" };
    getMockFetch().mockResolvedValue(okJson(responseData));

    const result = await apiMutate<{ id: string }>("/api/items", {
      body: { name: "test" },
    });

    expect(getMockFetch()).toHaveBeenCalledWith("/api/items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(result).toEqual(responseData);
  });

  it("supports PATCH method", async () => {
    getMockFetch().mockResolvedValue(okJson({ updated: true }));

    await apiMutate("/api/items/1", {
      method: "PATCH",
      body: { name: "updated" },
    });

    const init = getMockFetch().mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
  });

  it("supports DELETE method", async () => {
    getMockFetch().mockResolvedValue(okJson({ deleted: true }));

    await apiMutate("/api/items/1", { method: "DELETE" });

    const init = getMockFetch().mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });

  it("omits Content-Type and body when body is undefined", async () => {
    getMockFetch().mockResolvedValue(okJson({}));

    await apiMutate("/api/items/1", { method: "DELETE" });

    const init = getMockFetch().mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({});
    expect(init.body).toBeUndefined();
  });

  it("returns undefined for 204 No Content responses", async () => {
    getMockFetch().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiMutate<void>("/api/items/1", {
      method: "DELETE",
    });

    expect(result).toBeUndefined();
  });

  it("does not call response.json() for 204 responses", async () => {
    const response = new Response(null, { status: 204 });
    const jsonSpy = vi.spyOn(response, "json");
    getMockFetch().mockResolvedValue(response);

    await apiMutate<void>("/api/items/1", { method: "DELETE" });

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("throws on non-ok response", async () => {
    getMockFetch().mockResolvedValue(errorJson("Forbidden", 403));

    await expect(
      apiMutate("/api/items", { body: { name: "test" } }),
    ).rejects.toThrow("Forbidden");
  });

  it("serializes body as JSON", async () => {
    getMockFetch().mockResolvedValue(okJson({}));

    const complexBody = { nested: { array: [1, 2] }, flag: true };
    await apiMutate("/api/items", { body: complexBody });

    const init = getMockFetch().mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify(complexBody));
  });
});

// ── apiUpload ──

describe("apiUpload", () => {
  it("sends POST with FormData body and credentials", async () => {
    const responseData = { key: "uploads/file.png" };
    getMockFetch().mockResolvedValue(okJson(responseData));
    const formData = new FormData();
    formData.append("file", new Blob(["content"]), "file.png");

    const result = await apiUpload<{ key: string }>("/api/upload", formData);

    expect(getMockFetch()).toHaveBeenCalledWith("/api/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    expect(result).toEqual(responseData);
  });

  it("does not set Content-Type header (lets browser set multipart boundary)", async () => {
    getMockFetch().mockResolvedValue(okJson({}));
    const formData = new FormData();

    await apiUpload("/api/upload", formData);

    const init = getMockFetch().mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();
  });

  it("throws on non-ok response", async () => {
    getMockFetch().mockResolvedValue(errorJson("File too large", 413));
    const formData = new FormData();

    await expect(apiUpload("/api/upload", formData)).rejects.toThrow(
      "File too large",
    );
  });
});
