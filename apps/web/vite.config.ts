import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    nitro(),
  ],
  server: {
    port: 3001,
    host: "0.0.0.0",
    hmr: {
      clientPort: 3001,
    },
  },
  nitro: {
    preset: "node-server",
    routeRules: {
      "/api/**": {
        proxy: { to: "http://localhost:3000/api/**" },
      },
    },
  },
});
