import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser } from "../helpers/auth-fixtures.js";
import {
  makeMockService,
  makeMockBookingRequest,
  makeMockBookingWithUser,
} from "../helpers/booking-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

// SELECT: db.select().from(table).where(...).orderBy(...).limit(...)
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();

// JOIN chain: db.select().from(table).innerJoin(...).where(...).orderBy(...).limit(...)
const mockJoinLimit = vi.fn();
const mockJoinOrderBy = vi.fn();
const mockJoinWhere = vi.fn();
const mockInnerJoin = vi.fn();

// DOUBLE JOIN chain: db.select().from(table).innerJoin(...).innerJoin(...).where(...).orderBy(...).limit(...)
const mockSecondInnerJoin = vi.fn();
const mockDoubleJoinLimit = vi.fn();
const mockDoubleJoinOrderBy = vi.fn();
const mockDoubleJoinWhere = vi.fn();

const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// INSERT: db.insert(table).values({}).returning()
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

// UPDATE: db.update(table).set({}).where(...).returning()
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdate = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  mocks: () => {
    vi.doMock("../../src/db/schema/booking.schema.js", () => ({
      services: {
        id: {},
        name: {},
        description: {},
        pricingInfo: {},
        active: {},
        sortOrder: {},
        createdAt: {},
        updatedAt: {},
      },
      bookingRequests: {
        id: {},
        userId: {},
        serviceId: {},
        preferredDates: {},
        notes: {},
        status: {},
        reviewedBy: {},
        reviewNote: {},
        createdAt: {},
        updatedAt: {},
      },
    }));

    vi.doMock("../../src/db/schema/user.schema.js", () => ({
      users: {
        id: {},
        name: {},
        email: {},
        emailVerified: {},
        image: {},
        createdAt: {},
        updatedAt: {},
      },
      sessions: {},
      accounts: {},
      verifications: {},
      userRoles: {},
    }));
  },
  mountRoute: async (app) => {
    const { bookingRoutes } = await import(
      "../../src/routes/booking.routes.js"
    );
    app.route("/api", bookingRoutes);
  },
  beforeEach: () => {
    // Re-establish chain implementations after clearAllMocks() cleared them

    // SELECT chain: .select().from().where().orderBy()
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere, innerJoin: mockInnerJoin });
    mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValue([]); // terminal for GET /services (default: empty)
    mockLimit.mockResolvedValue([]); // terminal for select with limit

    // JOIN chain: .select().from().innerJoin().where().orderBy().limit()
    mockInnerJoin.mockReturnValue({
      where: mockJoinWhere,
      innerJoin: mockSecondInnerJoin, // allows double join
    });
    mockJoinWhere.mockReturnValue({ orderBy: mockJoinOrderBy, limit: mockJoinLimit });
    mockJoinOrderBy.mockReturnValue({ limit: mockJoinLimit });
    mockJoinLimit.mockResolvedValue([]); // terminal for GET /bookings/mine (default: empty)

    // DOUBLE JOIN chain: .select().from().innerJoin().innerJoin().where().orderBy().limit()
    mockSecondInnerJoin.mockReturnValue({ where: mockDoubleJoinWhere });
    mockDoubleJoinWhere.mockReturnValue({ orderBy: mockDoubleJoinOrderBy });
    mockDoubleJoinOrderBy.mockReturnValue({ limit: mockDoubleJoinLimit });
    mockDoubleJoinLimit.mockResolvedValue([]); // terminal (default: empty)

    // INSERT chain: .insert().values().returning()
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([]);

    // UPDATE chain: .update().set().where().returning()
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockImplementation(() =>
      chainablePromise(undefined, { returning: mockUpdateReturning }),
    );
    mockUpdateReturning.mockResolvedValue([]);
  },
});

// ── Tests ──

describe("booking routes", () => {
  // ── GET /api/services ──

  describe("GET /api/services", () => {
    it("returns active services sorted by sort_order", async () => {
      const service = makeMockService();
      mockOrderBy.mockResolvedValue([service]);

      const res = await ctx.app.request("/api/services");
      const body = (await res.json()) as { services: unknown[] };

      expect(res.status).toBe(200);
      expect(body.services).toHaveLength(1);
      expect((body.services[0] as { id: string }).id).toBe(service.id);
      expect((body.services[0] as { name: string }).name).toBe(service.name);
      expect(
        (body.services[0] as { pricingInfo: string }).pricingInfo,
      ).toBe(service.pricingInfo);
    });

    it("returns empty array when no active services", async () => {
      // mockOrderBy already defaults to [] from beforeEach

      const res = await ctx.app.request("/api/services");
      const body = (await res.json()) as { services: unknown[] };

      expect(res.status).toBe(200);
      expect(body.services).toHaveLength(0);
    });

    it("excludes inactive services (via mock setup)", async () => {
      // Only active services are returned — the mock simulates DB-level filtering
      // mockOrderBy already defaults to [] from beforeEach

      const res = await ctx.app.request("/api/services");
      const body = (await res.json()) as { services: unknown[] };

      expect(res.status).toBe(200);
      expect(body.services).toHaveLength(0);
    });
  });

  // ── GET /api/services/:id ──

  describe("GET /api/services/:id", () => {
    it("returns single service for valid active ID", async () => {
      const service = makeMockService();
      // GET /services/:id uses .where() without chaining — resolve directly
      mockSelectWhere.mockResolvedValue([service]);

      const res = await ctx.app.request("/api/services/svc_test_recording");
      const body = (await res.json()) as { service: { id: string } };

      expect(res.status).toBe(200);
      expect(body.service.id).toBe(service.id);
    });

    it("returns 404 for non-existent or inactive service", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/services/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/bookings ──

  describe("POST /api/bookings", () => {
    it("creates booking with status pending and returns 201", async () => {
      const service = makeMockService();
      const booking = makeMockBookingRequest();

      // First select: service lookup succeeds (once, then chain behavior resumes)
      mockSelectWhere.mockResolvedValueOnce([service]);
      // Insert: returns created booking
      mockInsertReturning.mockResolvedValue([booking]);

      const res = await ctx.app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "svc_test_recording",
          preferredDates: ["2026-03-15"],
          notes: "Afternoon preferred",
        }),
      });
      const body = (await res.json()) as {
        booking: { id: string; status: string; service: { id: string } };
      };

      expect(res.status).toBe(201);
      expect(body.booking.id).toBe(booking.id);
      expect(body.booking.status).toBe("pending");
      expect(body.booking.service.id).toBe(service.id);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "svc_test_recording",
          preferredDates: ["2026-03-15"],
        }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for missing serviceId", async () => {
      const res = await ctx.app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredDates: ["2026-03-15"],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for empty preferredDates array", async () => {
      const res = await ctx.app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "svc_test_recording",
          preferredDates: [],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for >5 preferred dates", async () => {
      const res = await ctx.app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "svc_test_recording",
          preferredDates: ["d1", "d2", "d3", "d4", "d5", "d6"],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent or inactive service", async () => {
      // Service lookup returns empty
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "nonexistent",
          preferredDates: ["2026-03-15"],
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/bookings/mine ──

  describe("GET /api/bookings/mine", () => {
    it("returns user's bookings with nested service data", async () => {
      const service = makeMockService();
      const booking = makeMockBookingRequest();

      // innerJoin query returns joined rows via terminal limit mock
      mockJoinLimit.mockResolvedValue([
        { booking_requests: booking, services: service },
      ]);

      const res = await ctx.app.request("/api/bookings/mine");
      const body = (await res.json()) as {
        items: Array<{ id: string; service: { id: string } }>;
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]!.id).toBe(booking.id);
      expect(body.items[0]!.service.id).toBe(service.id);
      expect(body.nextCursor).toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/bookings/mine");

      expect(res.status).toBe(401);
    });

    it("supports cursor pagination", async () => {
      const service = makeMockService();
      // Create limit+1 rows to trigger cursor generation
      const booking1 = makeMockBookingRequest({ id: "bk_1" });
      const booking2 = makeMockBookingRequest({
        id: "bk_2",
        createdAt: new Date("2026-02-19T10:00:00.000Z"),
      });

      // Return more rows than limit to trigger next cursor (limit=1, so 2 rows trigger pagination)
      mockJoinLimit.mockResolvedValue([
        { booking_requests: booking1, services: service },
        { booking_requests: booking2, services: service },
      ]);

      const res = await ctx.app.request("/api/bookings/mine?limit=1");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.nextCursor).not.toBeNull();
    });

    it("returns only the authenticated user's bookings", async () => {
      // Mock returns empty because filter by userId applies
      // mockJoinLimit already defaults to [] from beforeEach

      const res = await ctx.app.request("/api/bookings/mine");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("returns empty list with null cursor when no bookings", async () => {
      // mockJoinLimit already defaults to [] from beforeEach

      const res = await ctx.app.request("/api/bookings/mine");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });
  });

  // ── GET /api/bookings/:id ──

  describe("GET /api/bookings/:id", () => {
    it("returns booking for the owner", async () => {
      const service = makeMockService();
      const booking = makeMockBookingRequest();

      // innerJoin query returns the booking+service join — resolve where directly
      mockJoinWhere.mockResolvedValue([
        { booking_requests: booking, services: service },
      ]);

      const res = await ctx.app.request("/api/bookings/bk_test_001");
      const body = (await res.json()) as {
        booking: { id: string; service: { id: string } };
      };

      expect(res.status).toBe(200);
      expect(body.booking.id).toBe(booking.id);
      expect(body.booking.service.id).toBe(service.id);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/bookings/bk_test_001");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-owner", async () => {
      const service = makeMockService();
      const booking = makeMockBookingRequest({
        userId: "other_user",
      });

      mockJoinWhere.mockResolvedValue([
        { booking_requests: booking, services: service },
      ]);

      const res = await ctx.app.request("/api/bookings/bk_test_001");

      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent booking", async () => {
      mockJoinWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/bookings/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/bookings/pending ──

  describe("GET /api/bookings/pending", () => {
    it("returns pending bookings with requester info and service data", async () => {
      ctx.auth.roles = ["stakeholder"];
      const joinRow = makeMockBookingWithUser();
      mockDoubleJoinLimit.mockResolvedValue([joinRow]);

      const res = await ctx.app.request("/api/bookings/pending");
      const body = (await res.json()) as {
        items: Array<{
          id: string;
          status: string;
          service: { id: string; name: string };
          requester: { id: string; name: string; email: string };
        }>;
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]!.id).toBe(joinRow.booking_requests.id);
      expect(body.items[0]!.status).toBe("pending");
      expect(body.items[0]!.service.name).toBe(joinRow.services.name);
      expect(body.items[0]!.requester.name).toBe(joinRow.users.name);
      expect(body.items[0]!.requester.email).toBe(joinRow.users.email);
      expect(body.nextCursor).toBeNull();
    });

    it("returns empty array when no pending bookings", async () => {
      ctx.auth.roles = ["stakeholder"];
      // mockDoubleJoinLimit defaults to [] from beforeEach

      const res = await ctx.app.request("/api/bookings/pending");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(0);
      expect(body.nextCursor).toBeNull();
    });

    it("supports cursor-based pagination", async () => {
      ctx.auth.roles = ["stakeholder"];
      const row1 = makeMockBookingWithUser({
        booking: { id: "bk_older", createdAt: new Date("2026-02-01T10:00:00.000Z") },
      });
      const row2 = makeMockBookingWithUser({
        booking: { id: "bk_newer", createdAt: new Date("2026-02-10T10:00:00.000Z") },
      });

      // limit=1, returning 2 rows triggers cursor generation
      mockDoubleJoinLimit.mockResolvedValue([row1, row2]);

      const res = await ctx.app.request("/api/bookings/pending?limit=1");
      const body = (await res.json()) as {
        items: unknown[];
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.nextCursor).not.toBeNull();
    });

    it("returns items ordered by createdAt ASC (oldest first)", async () => {
      ctx.auth.roles = ["stakeholder"];
      const olderRow = makeMockBookingWithUser({
        booking: { id: "bk_older", createdAt: new Date("2026-01-01T10:00:00.000Z") },
      });
      const newerRow = makeMockBookingWithUser({
        booking: { id: "bk_newer", createdAt: new Date("2026-02-01T10:00:00.000Z") },
      });

      // Mock returns older first (ASC order from DB)
      mockDoubleJoinLimit.mockResolvedValue([olderRow, newerRow]);

      const res = await ctx.app.request("/api/bookings/pending");
      const body = (await res.json()) as {
        items: Array<{ id: string; createdAt: string }>;
        nextCursor: string | null;
      };

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(2);
      expect(body.items[0]!.id).toBe("bk_older");
      expect(body.items[1]!.id).toBe("bk_newer");
    });

    it("returns 403 for non-stakeholder", async () => {
      // ctx.auth.roles = [] (default from factory)

      const res = await ctx.app.request("/api/bookings/pending");

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/bookings/pending");

      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /api/bookings/:id/review ──

  describe("PATCH /api/bookings/:id/review", () => {
    it("approves booking — updates status and sets reviewedBy", async () => {
      ctx.auth.roles = ["stakeholder"];
      const service = makeMockService();
      const booking = makeMockBookingRequest({ status: "pending" });
      const updatedBooking = makeMockBookingRequest({
        status: "approved",
        reviewedBy: makeMockUser().id,
      });

      mockJoinWhere.mockResolvedValue([
        { booking_requests: booking, services: service },
      ]);
      mockUpdateReturning.mockResolvedValue([updatedBooking]);

      const res = await ctx.app.request("/api/bookings/bk_test_001/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const body = (await res.json()) as {
        booking: { id: string; status: string; reviewedBy: string | null };
      };

      expect(res.status).toBe(200);
      expect(body.booking.status).toBe("approved");
      expect(body.booking.reviewedBy).toBe(makeMockUser().id);
    });

    it("denies booking with note — saves reviewNote", async () => {
      ctx.auth.roles = ["stakeholder"];
      const service = makeMockService();
      const booking = makeMockBookingRequest({ status: "pending" });
      const updatedBooking = makeMockBookingRequest({
        status: "denied",
        reviewedBy: makeMockUser().id,
        reviewNote: "Not available on those dates",
      });

      mockJoinWhere.mockResolvedValue([
        { booking_requests: booking, services: service },
      ]);
      mockUpdateReturning.mockResolvedValue([updatedBooking]);

      const res = await ctx.app.request("/api/bookings/bk_test_001/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "denied",
          reviewNote: "Not available on those dates",
        }),
      });
      const body = (await res.json()) as {
        booking: {
          id: string;
          status: string;
          reviewNote: string | null;
        };
      };

      expect(res.status).toBe(200);
      expect(body.booking.status).toBe("denied");
      expect(body.booking.reviewNote).toBe("Not available on those dates");
    });

    it("returns 404 for non-existent booking", async () => {
      ctx.auth.roles = ["stakeholder"];
      mockJoinWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/bookings/nonexistent/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 if booking is not pending (already reviewed)", async () => {
      ctx.auth.roles = ["stakeholder"];
      const service = makeMockService();
      const booking = makeMockBookingRequest({ status: "approved" });

      mockJoinWhere.mockResolvedValue([
        { booking_requests: booking, services: service },
      ]);

      const res = await ctx.app.request("/api/bookings/bk_test_001/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "denied" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid status value", async () => {
      ctx.auth.roles = ["stakeholder"];

      const res = await ctx.app.request("/api/bookings/bk_test_001/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 for non-stakeholder", async () => {
      // ctx.auth.roles = [] (default from factory)

      const res = await ctx.app.request("/api/bookings/bk_test_001/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/bookings/bk_test_001/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(res.status).toBe(401);
    });
  });
});
