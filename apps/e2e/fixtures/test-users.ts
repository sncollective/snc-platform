/**
 * Demo seed user credentials — matches seed-demo.ts.
 * All users have password "password123".
 */

export const USERS = {
  /** Admin + stakeholder — can access /admin and /calendar. */
  alex: {
    id: "seed_user_alex",
    name: "Alex Rivera",
    email: "admin@snc.demo",
    password: "password123",
  },
  /** Stakeholder + creator (Maya Chen) — can access /calendar and creator manage. */
  maya: {
    id: "seed_user_maya",
    name: "Maya Chen",
    email: "maya@snc.demo",
    password: "password123",
    handle: "maya-chen",
  },
  /** Subscriber only — basic authenticated user. */
  pat: {
    id: "seed_user_pat",
    name: "Pat Morgan",
    email: "pat@snc.demo",
    password: "password123",
  },
} as const;

export type TestUser = (typeof USERS)[keyof typeof USERS];
