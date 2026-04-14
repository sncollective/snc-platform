import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    // Raised from defaults — see apps/api/vitest.config.ts for rationale.
    // Concurrent jsdom setup + dynamic imports across the fork pool push
    // heavy route tests past the default hookTimeout under load.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
