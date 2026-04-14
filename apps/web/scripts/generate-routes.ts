import { Generator, getConfig } from "@tanstack/router-generator";

// Standalone route-tree generator for CI typecheck.
// The Vite plugin runs this on dev/build/test; this script does the
// same work once, so `tsc` has `src/routeTree.gen.ts` available in
// environments that don't run Vite.

const root = process.cwd();
const config = getConfig({}, root);
const generator = new Generator({ config, root });

await generator.run();

// eslint-disable-next-line no-console
console.log("Generated routeTree.gen.ts");
