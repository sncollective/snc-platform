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
} as const;

export type TestUser = (typeof USERS)[keyof typeof USERS];
