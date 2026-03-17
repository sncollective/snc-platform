import type { AdminUser } from "@snc/shared";

// ── Public API ──

export function makeMockAdminUser(
  overrides?: Partial<AdminUser>,
): AdminUser {
  return {
    id: "user_admin_001",
    name: "Admin User",
    email: "admin@example.com",
    emailVerified: true,
    image: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    roles: ["admin"],
    ...overrides,
  };
}
