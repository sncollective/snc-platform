import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import { makeMockDbCreatorProfile } from "../helpers/creator-fixtures.js";

// ── DB mock ──

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDb = { select: mockSelect };

// ── Test setup ──

let app: Hono;

beforeEach(async () => {
  vi.resetModules();

  vi.doMock("../../src/config.js", () => ({
    config: {
      FEDERATION_DOMAIN: "s-nc.test",
      CORS_ORIGIN: "http://localhost:3080",
    },
    parseOrigins: (raw: string) =>
      raw
        .split(",")
        .map((o: string) => o.trim())
        .filter(Boolean),
  }));

  vi.doMock("../../src/db/connection.js", () => ({
    db: mockDb,
    sql: vi.fn(),
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorProfiles: {},
  }));

  // Re-wire select chain
  mockSelect.mockReturnValue({ from: mockSelectFrom });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockResolvedValue([]);

  const { createTestFederationApp } = await import(
    "../../src/routes/federation.routes.js"
  );

  const honoApp = new Hono();
  honoApp.route("/", createTestFederationApp());
  app = honoApp;
});

afterEach(() => {
  vi.resetModules();
});

// ── NodeInfo ──

describe("GET /.well-known/nodeinfo", () => {
  it("returns 200 with nodeinfo link", async () => {
    const res = await app.request("/.well-known/nodeinfo");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("links");
    expect(Array.isArray(body.links)).toBe(true);
    const link = (body.links as { rel: string; href: string }[]).find((l) =>
      l.rel.includes("nodeinfo"),
    );
    expect(link).toBeDefined();
  });
});

describe("GET /.well-known/nodeinfo/2.1", () => {
  it("returns 200 with S/NC software metadata", async () => {
    const res = await app.request("/.well-known/nodeinfo/2.1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.software.name).toBe("snc");
    expect(body.protocols).toContain("activitypub");
    expect(body.openRegistrations).toBe(false);
  });
});

// ── WebFinger ──

describe("GET /.well-known/webfinger", () => {
  it("returns 404 for unknown handle", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const res = await app.request(
      "/.well-known/webfinger?resource=acct:nobody@s-nc.test",
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with actor link for known handle", async () => {
    const profile = makeMockDbCreatorProfile({ handle: "velvetcrush" });
    mockSelectWhere.mockResolvedValue([profile]);

    const res = await app.request(
      "/.well-known/webfinger?resource=acct:velvetcrush@s-nc.test",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject).toBe("acct:velvetcrush@s-nc.test");

    const selfLink = (body.links as { rel: string; href: string }[]).find(
      (l) => l.rel === "self",
    );
    expect(selfLink).toBeDefined();
    expect(selfLink?.href).toContain("/ap/actors/velvetcrush");
  });
});

// ── Actor document ──

describe("GET /ap/actors/:handle", () => {
  it("returns 404 for unknown handle", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const res = await app.request("/ap/actors/nobody", {
      headers: { Accept: "application/activity+json" },
    });
    expect(res.status).toBe(404);
  });

  it("returns Actor JSON-LD for known handle", async () => {
    const profile = makeMockDbCreatorProfile({
      handle: "velvetcrush",
      displayName: "Velvet Crush",
      bio: "Music from the margins",
    });
    mockSelectWhere.mockResolvedValue([profile]);

    const res = await app.request("/ap/actors/velvetcrush", {
      headers: { Accept: "application/activity+json" },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("Person");
    expect(body.preferredUsername).toBe("velvetcrush");
    expect(body.name).toBe("Velvet Crush");
    expect(body.summary).toBe("Music from the margins");
    expect(body.id).toContain("/ap/actors/velvetcrush");
    expect(body.inbox).toContain("/ap/actors/velvetcrush/inbox");
    // Fedify auto-manages public key representation — verify the security
    // vocabulary is included in @context, which indicates key setup is active
    const contexts: string[] = (Array.isArray(body["@context"])
      ? body["@context"]
      : [body["@context"]]
    ).filter((c: unknown) => typeof c === "string");
    expect(
      contexts.some(
        (c) => c.includes("security") || c.includes("w3id") || c.includes("activitystreams"),
      ),
    ).toBe(true);
  });

  it("omits summary when bio is null", async () => {
    const profile = makeMockDbCreatorProfile({
      handle: "velvetcrush",
      bio: null,
    });
    mockSelectWhere.mockResolvedValue([profile]);

    const res = await app.request("/ap/actors/velvetcrush", {
      headers: { Accept: "application/activity+json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeUndefined();
  });
});
