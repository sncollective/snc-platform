import { describe, it, expect } from "vitest";

import {
  ROLES,
  RoleSchema,
  UserSchema,
  SessionSchema,
  AuthSessionSchema,
  type Role,
  type User,
  type Session,
  type AuthSession,
} from "../src/index.js";

// ── Test Fixtures ──

const VALID_USER = {
  id: "user_abc123",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const VALID_SESSION = {
  id: "session_xyz789",
  userId: "user_abc123",
  token: "tok_abc123xyz789",
  expiresAt: "2025-02-01T00:00:00Z",
};

describe("ROLES", () => {
  it("contains exactly the two expected roles", () => {
    expect(ROLES).toStrictEqual(["stakeholder", "admin"]);
  });

  it("has length 2", () => {
    expect(ROLES).toHaveLength(2);
  });
});

describe("RoleSchema", () => {
  it.each(["stakeholder", "admin"])(
    'accepts "%s"',
    (role) => {
      expect(RoleSchema.parse(role)).toBe(role);
    },
  );

  it("rejects an empty string", () => {
    expect(() => RoleSchema.parse("")).toThrow();
  });
});

describe("UserSchema", () => {
  it("validates a well-formed user object", () => {
    const result = UserSchema.parse(VALID_USER);
    expect(result.id).toBe(VALID_USER.id);
    expect(result.email).toBe(VALID_USER.email);
  });

  it("accepts image as null", () => {
    const result = UserSchema.parse({ ...VALID_USER, image: null });
    expect(result.image).toBeNull();
  });

  it("accepts image as a string", () => {
    const result = UserSchema.parse({
      ...VALID_USER,
      image: "https://example.com/avatar.png",
    });
    expect(result.image).toBe("https://example.com/avatar.png");
  });

  it("validates ISO datetime strings", () => {
    const result = UserSchema.parse({
      ...VALID_USER,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("rejects malformed input (empty object)", () => {
    expect(() => UserSchema.parse({})).toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      UserSchema.parse({ ...VALID_USER, email: "not-an-email" }),
    ).toThrow();
  });
});

describe("SessionSchema", () => {
  it("validates a well-formed session object", () => {
    const result = SessionSchema.parse(VALID_SESSION);
    expect(result.id).toBe(VALID_SESSION.id);
    expect(result.userId).toBe(VALID_SESSION.userId);
  });

  it("validates ISO datetime string for expiresAt", () => {
    const result = SessionSchema.parse({
      ...VALID_SESSION,
      expiresAt: "2025-02-01T00:00:00Z",
    });
    expect(typeof result.expiresAt).toBe("string");
  });

  it("rejects malformed input (empty object)", () => {
    expect(() => SessionSchema.parse({})).toThrow();
  });
});

describe("AuthSessionSchema", () => {
  it("validates a combined { user, session } object", () => {
    const result = AuthSessionSchema.parse({
      user: VALID_USER,
      session: VALID_SESSION,
    });
    expect(result.user.id).toBe(VALID_USER.id);
    expect(result.session.id).toBe(VALID_SESSION.id);
  });

  it("rejects when user is missing", () => {
    expect(() =>
      AuthSessionSchema.parse({ session: VALID_SESSION }),
    ).toThrow();
  });

  it("rejects when session is missing", () => {
    expect(() => AuthSessionSchema.parse({ user: VALID_USER })).toThrow();
  });

  it("rejects empty object", () => {
    expect(() => AuthSessionSchema.parse({})).toThrow();
  });
});

// ── Type-level assertions (compile-time only) ──

// These assignments verify that the inferred types are correct.
// If they compile, the types are correctly defined.
const _roleCheck: Role = "stakeholder";
const _userCheck: User = VALID_USER;
const _sessionCheck: Session = VALID_SESSION;
const _authSessionCheck: AuthSession = {
  user: VALID_USER,
  session: VALID_SESSION,
};
