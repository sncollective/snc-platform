import { config } from "dotenv";

config(); // loads .env from cwd (standalone server clone)
config({ path: "../../.env" }); // monorepo root fallback (dotenv won't override)
