import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Workaround: TanStack Start's startManifestPlugin overwrites route manifest
 * entries when a route has multiple split chunks (component + errorComponent).
 * The last chunk processed wins, so if errorComponent (no CSS) processes after
 * component (has CSS), the route loses its CSS assets → FOUC.
 *
 * This plugin captures CSS metadata from the client build so we can patch
 * the manifest in the SSR build.
 *
 * Upstream bug in @tanstack/start-plugin-core — remove when fixed.
 * See: startManifestPlugin plugin.ts lines 195-199
 */
const routeCssMap = new Map<string, Set<string>>();

function captureRouteCss(): Plugin {
  return {
    name: "snc:capture-route-css",
    applyToEnvironment(env) {
      return env.name === "client";
    },
    generateBundle(_options, bundle) {
      const chunksByFileName = new Map<string, (typeof bundle)[string]>();
      for (const [fileName, entry] of Object.entries(bundle)) {
        if (entry.type === "chunk") {
          chunksByFileName.set(fileName, entry);
        }
      }

      // Collect CSS recursively for each chunk
      const getCss = (
        fileName: string,
        visited = new Set<string>(),
      ): Set<string> => {
        if (visited.has(fileName)) return new Set();
        visited.add(fileName);
        const chunk = chunksByFileName.get(fileName);
        if (!chunk || chunk.type !== "chunk") return new Set();
        const css = new Set<string>(chunk.viteMetadata?.importedCss ?? []);
        for (const imp of chunk.imports) {
          for (const c of getCss(imp, visited)) css.add(c);
        }
        return css;
      };

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;
        const routeModules = chunk.moduleIds.filter((m: string) =>
          m.includes("tsr-split"),
        );
        if (routeModules.length === 0) continue;

        const css = getCss(fileName);
        for (const mod of routeModules) {
          const filePath = mod.split("?")[0]!;
          const existing = routeCssMap.get(filePath) ?? new Set<string>();
          for (const c of css) existing.add(c);
          routeCssMap.set(filePath, existing);
        }
      }
    },
  };
}

function patchManifestCss(): Plugin {
  return {
    name: "snc:patch-manifest-css",
    applyToEnvironment(env) {
      return env.name !== "client";
    },
    transform: {
      filter: { id: /tanstack-start-manifest/ },
      handler(code) {
        if (!code.includes("tsrStartManifest")) return;
        if (routeCssMap.size === 0) return;

        // Parse the manifest, add missing CSS, re-serialize
        const match = code.match(
          /tsrStartManifest = \(\) => \((\{[\s\S]+\})\)/,
        );
        if (!match?.[1]) return;

        // eslint-disable-next-line no-eval
        const manifest = eval(`(${match[1]})`);
        let patched = false;

        for (const [routeId, route] of Object.entries(
          manifest.routes as Record<
            string,
            { filePath?: string; assets?: Array<{ attrs?: { href?: string } }> }
          >,
        )) {
          if (!route.filePath) continue;
          const cssFiles = routeCssMap.get(route.filePath);
          if (!cssFiles || cssFiles.size === 0) continue;

          const existingHrefs = new Set(
            (route.assets ?? []).map((a) => a.attrs?.href).filter(Boolean),
          );
          for (const cssFile of cssFiles) {
            const href = `/${cssFile}`;
            if (!existingHrefs.has(href)) {
              route.assets = route.assets ?? [];
              route.assets.push({
                tag: "link",
                attrs: { rel: "stylesheet", href, type: "text/css" },
              } as never);
              patched = true;
            }
          }
        }

        if (!patched) return;
        return code.replace(
          match[0],
          `tsrStartManifest = () => (${JSON.stringify(manifest)})`,
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    captureRouteCss(),
    patchManifestCss(),
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
  },
});
