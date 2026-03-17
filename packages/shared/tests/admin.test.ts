import { describe, it, expect } from "vitest";

import {
  AdminUserSchema,
  AdminUsersQuerySchema,
  AdminUsersResponseSchema,
  AssignRoleRequestSchema,
  RevokeRoleRequestSchema,
  AdminUserResponseSchema,
  type AdminUser,
  type AdminUsersQuery,
  type AdminUsersResponse,
  type AssignRoleRequest,
  type RevokeRoleRequest,
  type AdminUserResponse,
} from "../src/index.js";

// ── Test Fixtures ──

const VALID_ADMIN_USER = {
  id: "user_abc123",
  name: "Admin User",
  email: "admin@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  roles: ["admin", "stakeholder"],
};

describe("AdminUserSchema", () => {
  it("validates a well-formed admin user with roles", () => {
    const result = AdminUserSchema.parse(VALID_ADMIN_USER);
    expect(result.id).toBe(VALID_ADMIN_USER.id);
    expect(result.email).toBe(VALID_ADMIN_USER.email);
    expect(result.roles).toStrictEqual(["admin", "stakeholder"]);
  });

  it("accepts an empty roles array", () => {
    const result = AdminUserSchema.parse({ ...VALID_ADMIN_USER, roles: [] });
    expect(result.roles).toStrictEqual([]);
  });

  it("accepts all valid role values", () => {
    const result = AdminUserSchema.parse({
      ...VALID_ADMIN_USER,
      roles: ["stakeholder", "admin"],
    });
    expect(result.roles).toHaveLength(2);
  });

  it("accepts image as a string", () => {
    const result = AdminUserSchema.parse({
      ...VALID_ADMIN_USER,
      image: "https://example.com/avatar.png",
    });
    expect(result.image).toBe("https://example.com/avatar.png");
  });

  it("rejects invalid role in roles array", () => {
    expect(() =>
      AdminUserSchema.parse({ ...VALID_ADMIN_USER, roles: ["invalid-role"] }),
    ).toThrow();
  });

  it("rejects missing roles field", () => {
    const { roles: _, ...withoutRoles } = VALID_ADMIN_USER;
    expect(() => AdminUserSchema.parse(withoutRoles)).toThrow();
  });

  it("rejects malformed input (empty object)", () => {
    expect(() => AdminUserSchema.parse({})).toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      AdminUserSchema.parse({ ...VALID_ADMIN_USER, email: "not-an-email" }),
    ).toThrow();
  });
});

describe("AdminUsersQuerySchema", () => {
  it("applies default limit of 20 when not provided", () => {
    const result = AdminUsersQuerySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it("coerces string limit to number", () => {
    const result = AdminUsersQuerySchema.parse({ limit: "50" });
    expect(result.limit).toBe(50);
  });

  it("accepts cursor as optional string", () => {
    const result = AdminUsersQuerySchema.parse({ cursor: "abc123" });
    expect(result.cursor).toBe("abc123");
  });

  it("allows omitting cursor", () => {
    const result = AdminUsersQuerySchema.parse({});
    expect(result.cursor).toBeUndefined();
  });

  it("validates limit at minimum boundary (1)", () => {
    const result = AdminUsersQuerySchema.parse({ limit: 1 });
    expect(result.limit).toBe(1);
  });

  it("validates limit at maximum boundary (100)", () => {
    const result = AdminUsersQuerySchema.parse({ limit: 100 });
    expect(result.limit).toBe(100);
  });

  it("rejects limit below minimum (0)", () => {
    expect(() => AdminUsersQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects limit above maximum (101)", () => {
    expect(() => AdminUsersQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("rejects non-integer limit (1.5)", () => {
    expect(() => AdminUsersQuerySchema.parse({ limit: 1.5 })).toThrow();
  });
});

describe("AdminUsersResponseSchema", () => {
  it("validates complete response with items and nextCursor", () => {
    const result = AdminUsersResponseSchema.parse({
      items: [VALID_ADMIN_USER],
      nextCursor: "cursor_abc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(VALID_ADMIN_USER.id);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("validates with empty items array", () => {
    const result = AdminUsersResponseSchema.parse({
      items: [],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(0);
  });

  it("validates nextCursor as null", () => {
    const result = AdminUsersResponseSchema.parse({
      items: [VALID_ADMIN_USER],
      nextCursor: null,
    });
    expect(result.nextCursor).toBeNull();
  });

  it("validates with multiple items", () => {
    const result = AdminUsersResponseSchema.parse({
      items: [
        VALID_ADMIN_USER,
        { ...VALID_ADMIN_USER, id: "user_def456", email: "other@example.com" },
      ],
      nextCursor: null,
    });
    expect(result.items).toHaveLength(2);
  });

  it("rejects missing items field", () => {
    expect(() =>
      AdminUsersResponseSchema.parse({ nextCursor: null }),
    ).toThrow();
  });

  it("rejects missing nextCursor field", () => {
    expect(() =>
      AdminUsersResponseSchema.parse({ items: [] }),
    ).toThrow();
  });

  it("rejects invalid items in array", () => {
    expect(() =>
      AdminUsersResponseSchema.parse({
        items: [{ invalid: true }],
        nextCursor: null,
      }),
    ).toThrow();
  });
});

describe("AssignRoleRequestSchema", () => {
  it('validates { role: "admin" }', () => {
    const result = AssignRoleRequestSchema.parse({ role: "admin" });
    expect(result.role).toBe("admin");
  });

  it.each(["stakeholder", "admin"])(
    'accepts role "%s"',
    (role) => {
      const result = AssignRoleRequestSchema.parse({ role });
      expect(result.role).toBe(role);
    },
  );

  it("rejects invalid role value", () => {
    expect(() =>
      AssignRoleRequestSchema.parse({ role: "superadmin" }),
    ).toThrow();
  });

  it("rejects empty string role", () => {
    expect(() =>
      AssignRoleRequestSchema.parse({ role: "" }),
    ).toThrow();
  });

  it("rejects missing role field", () => {
    expect(() => AssignRoleRequestSchema.parse({})).toThrow();
  });
});

describe("RevokeRoleRequestSchema", () => {
  it('validates { role: "stakeholder" }', () => {
    const result = RevokeRoleRequestSchema.parse({ role: "stakeholder" });
    expect(result.role).toBe("stakeholder");
  });

  it.each(["stakeholder", "admin"])(
    'accepts role "%s"',
    (role) => {
      const result = RevokeRoleRequestSchema.parse({ role });
      expect(result.role).toBe(role);
    },
  );

  it("rejects invalid role value", () => {
    expect(() =>
      RevokeRoleRequestSchema.parse({ role: "manager" }),
    ).toThrow();
  });

  it("rejects empty string role", () => {
    expect(() =>
      RevokeRoleRequestSchema.parse({ role: "" }),
    ).toThrow();
  });

  it("rejects missing role field", () => {
    expect(() => RevokeRoleRequestSchema.parse({})).toThrow();
  });
});

describe("AdminUserResponseSchema", () => {
  it("validates { user: AdminUser }", () => {
    const result = AdminUserResponseSchema.parse({ user: VALID_ADMIN_USER });
    expect(result.user.id).toBe(VALID_ADMIN_USER.id);
    expect(result.user.roles).toStrictEqual(["admin", "stakeholder"]);
  });

  it("rejects missing user field", () => {
    expect(() => AdminUserResponseSchema.parse({})).toThrow();
  });

  it("rejects invalid user object", () => {
    expect(() =>
      AdminUserResponseSchema.parse({ user: { invalid: true } }),
    ).toThrow();
  });

  it("rejects user without roles", () => {
    const { roles: _, ...userWithoutRoles } = VALID_ADMIN_USER;
    expect(() =>
      AdminUserResponseSchema.parse({ user: userWithoutRoles }),
    ).toThrow();
  });
});

// ── Type-level assertions (compile-time only) ──

const _adminUserCheck: AdminUser = VALID_ADMIN_USER;
const _adminUsersQueryCheck: AdminUsersQuery = { limit: 20 };
const _adminUsersResponseCheck: AdminUsersResponse = {
  items: [VALID_ADMIN_USER],
  nextCursor: null,
};
const _assignRoleRequestCheck: AssignRoleRequest = { role: "admin" };
const _revokeRoleRequestCheck: RevokeRoleRequest = { role: "stakeholder" };
const _adminUserResponseCheck: AdminUserResponse = { user: VALID_ADMIN_USER };
