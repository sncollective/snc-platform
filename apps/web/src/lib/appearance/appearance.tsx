import { useEffect, useSyncExternalStore } from "react";

import {
  appearanceController,
  type AppearanceController,
  type AppearancePreference,
  type AppearanceSnapshot,
} from "./appearance-controller.js";

export interface AppearanceState extends AppearanceSnapshot {
  readonly setPreference: (preference: AppearancePreference) => void;
}

/** Mount exactly once in the root document; settings controls only consume its store. */
export function AppearanceControllerLifecycle(): null {
  useEffect(() => {
    appearanceController.start();
    return appearanceController.stop;
  }, []);

  return null;
}

export function useAppearance(
  controller: AppearanceController = appearanceController,
): AppearanceState {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );

  return {
    ...snapshot,
    setPreference: (preference) => controller.applyPreference(preference, "local"),
  };
}
