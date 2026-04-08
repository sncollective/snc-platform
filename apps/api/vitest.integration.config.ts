import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config();
config({ path: "../../.env" });

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
    pool: "forks",
    restoreMocks: true,
    mockReset: true,
    unstubGlobals: true,
  },
});
