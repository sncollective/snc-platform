import { migrateContentLibraryImages } from "../services/content-library-migration.js";
import { sql } from "../db/connection.js";

const main = async (): Promise<void> => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_CONTENT_LIBRARY_MIGRATION !== "true"
  ) {
    throw new Error(
      "Refusing production migration without ALLOW_CONTENT_LIBRARY_MIGRATION=true",
    );
  }

  const summary = await migrateContentLibraryImages();
  console.log("Content-library image migration complete:", summary);
};

try {
  await main();
} catch (cause) {
  console.error(
    "Content-library image migration failed; live references were not partially committed:",
    cause,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
