import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

import { users, userRoles } from "../db/schema/user.schema.js";
import { rootLogger } from "../logging/logger.js";

const email = process.argv[2];

if (!email) {
  rootLogger.error(
    "Usage: bun run --filter @snc/api seed:admin <email> — the user must already exist (sign up via the web UI first).",
  );
  process.exit(1);
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  rootLogger.error("DATABASE_URL environment variable is required.");
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
    rootLogger.error(
      { email },
      `No user found with email "${email}" — the user must sign up via the web UI before being granted admin.`,
    );
    await sql.end();
    process.exit(1);
  }

  // Assign admin role (idempotent)
  await db
    .insert(userRoles)
    .values({ userId: user.id, role: "admin" })
    .onConflictDoNothing();

  rootLogger.info(
    { userId: user.id, email: user.email },
    `Admin role granted to ${user.name} (${user.email}).`,
  );
} catch (e) {
  rootLogger.error({ error: e instanceof Error ? e.message : e }, "Failed to grant admin role.");
  process.exit(1);
} finally {
  await sql.end();
}
