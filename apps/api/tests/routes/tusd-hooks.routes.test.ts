import { describe, it, expect, vi } from "vitest";

import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock State ──

const mockGetSession = vi.fn();
const mockHydrateAuthContext = vi.fn();
const mockCompleteUploadFlow = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();

const mockStorage = {
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
  head: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
};

// ── Test Setup ──

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
  mocks: () => {
    vi.doMock("../../src/auth/auth.js", () => ({
      auth: {
        api: { getSession: mockGetSession },
      },
    }));

    vi.doMock("../../src/middleware/auth-helpers.js", () => ({
      hydrateAuthContext: mockHydrateAuthContext,
    }));

    vi.doMock("../../src/services/upload-completion.js", () => ({
      completeUploadFlow: mockCompleteUploadFlow,
    }));

    vi.doMock("../../src/storage/index.js", () => ({
      storage: mockStorage,
    }));

    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: {
        error: mockLoggerError,
        info: mockLoggerInfo,
        warn: mockLoggerWarn,
      },
    }));
  },
  mountRoute: async (app) => {
    const { tusdHookRoutes } = await import("../../src/routes/tusd-hooks.routes.js");
    app.route("/api/tusd", tusdHookRoutes);
  },
  beforeEach: () => {
    mockGetSession.mockReset();
    mockHydrateAuthContext.mockReset();
    mockCompleteUploadFlow.mockReset();
    mockLoggerError.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();

    // Default: authenticated session + hydrated context
    const mockUser = makeMockUser();
    const mockSession = makeMockSession();
    mockGetSession.mockResolvedValue({ user: mockUser, session: mockSession });
    mockHydrateAuthContext.mockResolvedValue({
      user: mockUser,
      session: mockSession,
      roles: [],
    });
    mockCompleteUploadFlow.mockResolvedValue({ key: "tus/upload-123" });
  },
});

// ── Fixtures ──

/** Sentinel to explicitly omit a metadata key in makePreCreateBody. */
const OMIT = Symbol("OMIT");

function makePreCreateBody(overrides?: {
  purpose?: string | typeof OMIT;
  resourceId?: string | typeof OMIT;
  cookieHeader?: string;
}): object {
  const headers: Record<string, string[]> = {
    Cookie: [overrides?.cookieHeader ?? "session=abc123"],
  };

  const meta: Record<string, string> = {};
  if (overrides?.purpose !== OMIT) meta["purpose"] = (overrides?.purpose as string | undefined) ?? "content-media";
  if (overrides?.resourceId !== OMIT) meta["resourceId"] = (overrides?.resourceId as string | undefined) ?? "content-test-1";

  return {
    Type: "pre-create",
    Event: {
      Upload: {
        ID: "tus-upload-pre-1",
        Size: 1024,
        SizeIsDeferred: false,
        Offset: 0,
        MetaData: meta,
        IsPartial: false,
        IsFinal: false,
        PartialUploads: null,
        Storage: { Type: "s3store", Bucket: "snc-uploads", Key: "" },
      },
      HTTPRequest: {
        Method: "POST",
        URI: "/files",
        RemoteAddr: "127.0.0.1:12345",
        Header: headers,
      },
    },
  };
}

function makePostFinishBody(overrides?: Partial<{
  storageType: string;
  s3Key: string;
  purpose: string;
  resourceId: string;
  cookieHeader: string;
}>): object {
  const headers: Record<string, string[]> = {
    Cookie: [overrides?.cookieHeader ?? "session=abc123"],
  };

  return {
    Type: "post-finish",
    Event: {
      Upload: {
        ID: "tus-upload-finish-1",
        Size: 10485760,
        SizeIsDeferred: false,
        Offset: 10485760,
        MetaData: {
          purpose: overrides?.purpose ?? "content-media",
          resourceId: overrides?.resourceId ?? "content-test-1",
        },
        IsPartial: false,
        IsFinal: false,
        PartialUploads: null,
        Storage: {
          Type: overrides?.storageType ?? "s3store",
          Bucket: "snc-uploads",
          Key: overrides?.s3Key ?? "tus/upload-abc123",
        },
      },
      HTTPRequest: {
        Method: "PATCH",
        URI: "/files/tus-upload-finish-1",
        RemoteAddr: "127.0.0.1:12345",
        Header: headers,
      },
    },
  };
}

function makePostTerminateBody(): object {
  return {
    Type: "post-terminate",
    Event: {
      Upload: {
        ID: "tus-upload-term-1",
        Size: 0,
        SizeIsDeferred: false,
        Offset: 0,
        MetaData: {},
        IsPartial: false,
        IsFinal: false,
        PartialUploads: null,
        Storage: { Type: "s3store", Bucket: "snc-uploads", Key: "" },
      },
      HTTPRequest: {
        Method: "DELETE",
        URI: "/files/tus-upload-term-1",
        RemoteAddr: "127.0.0.1:12345",
        Header: { Cookie: ["session=abc123"] },
      },
    },
  };
}

// ── Tests ──

describe("tusd hook routes", () => {
  // ── POST /api/tusd/hooks — pre-create ──

  describe("pre-create hook", () => {
    it("rejects when no auth headers are forwarded", async () => {
      const body = {
        Type: "pre-create",
        Event: {
          Upload: {
            ID: "tus-1",
            Size: 1024,
            SizeIsDeferred: false,
            Offset: 0,
            MetaData: { purpose: "content-media", resourceId: "content-test-1" },
            IsPartial: false,
            IsFinal: false,
            PartialUploads: null,
            Storage: { Type: "s3store", Bucket: "snc-uploads", Key: "" },
          },
          HTTPRequest: {
            Method: "POST",
            URI: "/files",
            RemoteAddr: "127.0.0.1",
            // No Cookie, no Authorization
            Header: {},
          },
        },
      };

      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { RejectUpload?: boolean; HTTPResponse?: { StatusCode: number } };

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBe(true);
      expect(json.HTTPResponse?.StatusCode).toBe(401);
    });

    it("rejects when getSession returns null", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody()),
      });
      const json = await res.json() as { RejectUpload?: boolean; HTTPResponse?: { StatusCode: number } };

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBe(true);
      expect(json.HTTPResponse?.StatusCode).toBe(401);
    });

    it("rejects when purpose metadata is missing", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody({ purpose: OMIT })),
      });
      const json = await res.json() as { RejectUpload?: boolean; HTTPResponse?: { StatusCode: number } };

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBe(true);
      expect(json.HTTPResponse?.StatusCode).toBe(400);
    });

    it("rejects when purpose is not a valid enum value", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody({ purpose: "not-a-valid-purpose" })),
      });
      const json = await res.json() as { RejectUpload?: boolean; HTTPResponse?: { StatusCode: number } };

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBe(true);
      expect(json.HTTPResponse?.StatusCode).toBe(400);
    });

    it("rejects creator-avatar purpose (not in TUS_PURPOSES)", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody({ purpose: "creator-avatar" })),
      });
      const json = await res.json() as { RejectUpload?: boolean; HTTPResponse?: { StatusCode: number } };

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBe(true);
      expect(json.HTTPResponse?.StatusCode).toBe(400);
    });

    it("rejects when resourceId metadata is missing", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody({ resourceId: OMIT })),
      });
      const json = await res.json() as { RejectUpload?: boolean; HTTPResponse?: { StatusCode: number } };

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBe(true);
      expect(json.HTTPResponse?.StatusCode).toBe(400);
    });

    it("allows valid content-media with a valid session", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody({ purpose: "content-media" })),
      });
      const json = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBeUndefined();
      expect(Object.keys(json)).toHaveLength(0);
    });

    it("allows valid playout-media with a valid session", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePreCreateBody({ purpose: "playout-media" })),
      });
      const json = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(json.RejectUpload).toBeUndefined();
    });
  });

  // ── POST /api/tusd/hooks — post-finish ──

  describe("post-finish hook", () => {
    it("calls completeUploadFlow with skipKeyValidation: true and the S3 key", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePostFinishBody({ s3Key: "tus/upload-abc123" })),
      });
      const json = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(Object.keys(json)).toHaveLength(0);
      expect(mockCompleteUploadFlow).toHaveBeenCalledOnce();
      expect(mockCompleteUploadFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ key: "tus/upload-abc123" }),
          skipKeyValidation: true,
        }),
      );
    });

    it("logs error and returns 200 when session is invalid", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePostFinishBody()),
      });

      expect(res.status).toBe(200);
      expect(mockCompleteUploadFlow).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({ tusId: "tus-upload-finish-1" }),
        "tusd post-finish: invalid session",
      );
    });

    it("logs error and returns 200 when storage type is not s3store", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePostFinishBody({ storageType: "filestore" })),
      });

      expect(res.status).toBe(200);
      expect(mockCompleteUploadFlow).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({ storageType: "filestore" }),
        "tusd post-finish: unexpected storage type",
      );
    });
  });

  // ── POST /api/tusd/hooks — post-terminate ──

  describe("post-terminate hook", () => {
    it("returns 200 with empty body", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePostTerminateBody()),
      });
      const json = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(Object.keys(json)).toHaveLength(0);
    });
  });

  // ── POST /api/tusd/hooks — unknown hook type ──

  describe("unknown hook type", () => {
    it("returns {} and logs a warning for unhandled hook types", async () => {
      const res = await ctx.app.request("/api/tusd/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Type: "post-receive",
          Event: {
            Upload: {
              ID: "tus-unknown-1",
              Size: 1024,
              SizeIsDeferred: false,
              Offset: 512,
              MetaData: {},
              IsPartial: false,
              IsFinal: false,
              PartialUploads: null,
              Storage: { Type: "s3store", Bucket: "snc-uploads", Key: "" },
            },
            HTTPRequest: {
              Method: "PATCH",
              URI: "/files/tus-unknown-1",
              RemoteAddr: "127.0.0.1",
              Header: {},
            },
          },
        }),
      });
      const json = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(Object.keys(json)).toHaveLength(0);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ hookType: "post-receive" }),
        "Unhandled tusd hook type",
      );
    });
  });
});
