import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

import { users, userRoles } from "../db/schema/user.schema.js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: bun run --filter @snc/api seed:admin <email>");
  console.error("  The user must already exist (sign up via the web UI first).");
  process.exit(1);
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error("Error: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = postgres(databaseUrl);
const db = drizzle(sql);

try {
  // Find user by email
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    console.error(`Error: No user found with email "${email}".`);
    console.error("  The user must sign up via the web UI before being granted admin.");
    await sql.end();
    process.exit(1);
  }

  // Assign admin role (idempotent)
  await db
    .insert(userRoles)
    .values({ userId: user.id, role: "admin" })
    .onConflictDoNothing();

  console.log(`Admin role granted to ${user.name} (${user.email}).`);
} catch (e) {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await sql.end();
}
