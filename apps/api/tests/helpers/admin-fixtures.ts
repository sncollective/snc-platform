import type { AdminUser } from "@snc/shared";

// ── Public API ──

export const makeMockAdminUser = (
  overrides?: Partial<AdminUser>,
): AdminUser => ({
  id: "user_admin_001",
  name: "Admin User",
  email: "admin@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  roles: ["admin"],
  ...overrides,
});

export const makeMockDbUser = (
  overrides?: Partial<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) => ({
  id: "user_target_001",
  name: "Target User",
  email: "target@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2025-01-15T00:00:00Z"),
  updatedAt: new Date("2025-01-15T00:00:00Z"),
  ...overrides,
});
