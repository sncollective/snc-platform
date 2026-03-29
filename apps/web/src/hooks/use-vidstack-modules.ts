import { useEffect, useState } from "react";

// ── Public Types ──

export interface VidstackModules {
  readonly core: typeof import("@vidstack/react");
  readonly layouts: typeof import("@vidstack/react/player/layouts/default");
}

// ── Public API ──

/** Dynamically imports Vidstack core and layout modules once. Returns null until modules are loaded. Safe for SSR — import only runs in the browser. */
export function useVidstackModules(): VidstackModules | null {
  const [modules, setModules] = useState<VidstackModules | null>(null);

  useEffect(() => {
    Promise.all([
      import("@vidstack/react"),
      import("@vidstack/react/player/layouts/default"),
    ])
      .then(([core, layouts]) => {
        setModules({ core, layouts });
      })
      .catch(() => {
        // Modules remain null — caller renders skeleton/nothing
      });
  }, []);

  return modules;
}
