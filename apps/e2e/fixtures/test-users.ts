/**
 * Demo seed user credentials — matches seed-demo.ts.
 * All users have password "password123".
 */

export const USERS = {
  /** Admin + stakeholder — can access /admin and /calendar. */
  alex: {
    id: "00000000-0000-4000-a000-000000000001",
    name: "Alex Rivera",
    email: "admin@snc.demo",
    password: "password123",
  },
  /** Stakeholder + creator (Maya Chen) — can access /calendar and creator manage. */
  maya: {
    id: "00000000-0000-4000-a000-000000000002",
    name: "Maya Chen",
    email: "maya@snc.demo",
    password: "password123",
    handle: "maya-chen",
  },
  /** Subscriber only — basic authenticated user. */
  pat: {
    id: "00000000-0000-4000-a000-000000000005",
    name: "Pat Morgan",
    email: "pat@snc.demo",
    password: "password123",
  },
  /**
   * Stakeholder + creator (Jordan Ellis), owner of his own profile but with NO
   * provisioned channel — the seed deliberately leaves Jordan unprovisioned so
   * the lazy channel-provisioning path stays exercisable. Used by the
   * provisioning e2e via `auth/creator-unprovisioned.json`.
   */
  jordan: {
    id: "00000000-0000-4000-a000-000000000003",
    name: "Jordan Ellis",
    email: "jordan@snc.demo",
    password: "password123",
    handle: "jordan-ellis",
  },
} as const;

export type TestUser = (typeof USERS)[keyof typeof USERS];
