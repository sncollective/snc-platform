export const APPEARANCE_STORAGE_KEY = "snc.appearance.theme";
export const APPEARANCE_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const APPEARANCE_PREFERENCES = ["light", "dark", "system"] as const;
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type EffectiveAppearance = Exclude<AppearancePreference, "system">;
export type AppearanceChangeSource = "hydrate" | "local" | "storage" | "media";

export interface AppearanceSnapshot {
  readonly preference: AppearancePreference;
  readonly effective: EffectiveAppearance;
}

export interface AppearanceMediaQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export interface AppearanceControllerEnvironment {
  readonly documentElement: Pick<HTMLElement, "getAttribute" | "setAttribute">;
  readStoredPreference(): string | null;
  writeStoredPreference(value: AppearancePreference): void;
  getMediaQuery(): AppearanceMediaQuery | null;
  addStorageListener(listener: (value: string | null) => void): void;
  removeStorageListener(listener: (value: string | null) => void): void;
}

type EnvironmentFactory = () => AppearanceControllerEnvironment | null;
type Subscriber = () => void;

const SERVER_SNAPSHOT: AppearanceSnapshot = Object.freeze({
  preference: "system",
  effective: "light",
});

export function normalizeAppearancePreference(value: unknown): AppearancePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function createBrowserEnvironment(): AppearanceControllerEnvironment | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  let mediaQuery: MediaQueryList | null = null;
  const storageWrappers = new Map<
    (value: string | null) => void,
    (event: StorageEvent) => void
  >();

  return {
    documentElement: document.documentElement,
    readStoredPreference: () => window.localStorage.getItem(APPEARANCE_STORAGE_KEY),
    writeStoredPreference: (value) => window.localStorage.setItem(APPEARANCE_STORAGE_KEY, value),
    getMediaQuery: () => {
      if (mediaQuery !== null) return mediaQuery;
      try {
        mediaQuery = window.matchMedia(APPEARANCE_MEDIA_QUERY);
      } catch {
        return null;
      }
      return mediaQuery;
    },
    addStorageListener: (listener) => {
      const wrapper = (event: StorageEvent) => {
        if (event.key !== APPEARANCE_STORAGE_KEY) return;
        try {
          if (event.storageArea !== null && event.storageArea !== window.localStorage) return;
        } catch {
          return;
        }
        listener(event.newValue);
      };
      storageWrappers.set(listener, wrapper);
      window.addEventListener("storage", wrapper);
    },
    removeStorageListener: (listener) => {
      const wrapper = storageWrappers.get(listener);
      if (wrapper !== undefined) {
        window.removeEventListener("storage", wrapper);
        storageWrappers.delete(listener);
      }
    },
  };
}

/**
 * The sole hydrated owner of appearance state. The pre-hydration bootstrap only seeds DOM
 * attributes; this controller owns persistence and listeners after start().
 */
export class AppearanceController {
  private environment: AppearanceControllerEnvironment | null = null;
  private mediaQuery: AppearanceMediaQuery | null = null;
  private snapshot: AppearanceSnapshot = SERVER_SNAPSHOT;
  private readonly subscribers = new Set<Subscriber>();
  private generation = 0;
  private initialized = false;
  private started = false;
  private mediaListener: (() => void) | null = null;

  constructor(private readonly environmentFactory: EnvironmentFactory = createBrowserEnvironment) {}

  readonly getSnapshot = (): AppearanceSnapshot => this.snapshot;
  readonly getServerSnapshot = (): AppearanceSnapshot => SERVER_SNAPSHOT;

  readonly subscribe = (subscriber: Subscriber): (() => void) => {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  };

  readonly start = (): void => {
    if (this.started) return;

    this.environment = this.environmentFactory();
    if (this.environment === null) return;

    this.started = true;
    this.mediaQuery = this.safeGetMediaQuery();
    try {
      this.environment.addStorageListener(this.handleStorageChange);
    } catch {
      // Storage synchronization is an enhancement; appearance must remain usable when
      // browser privacy policy blocks event registration.
    }
    this.applyPreference(this.safeReadPreference(), "hydrate");
  };

  readonly stop = (): void => {
    if (!this.started || this.environment === null) return;

    this.unbindMediaListener();
    try {
      this.environment.removeStorageListener(this.handleStorageChange);
    } catch {
      // Symmetric best-effort teardown for restricted browser environments.
    }
    this.generation += 1;
    this.initialized = false;
    this.started = false;
    this.mediaQuery = null;
    this.environment = null;
  };

  readonly applyPreference = (
    value: AppearancePreference,
    source: AppearanceChangeSource,
  ): void => {
    const environment = this.environment;
    if (environment === null) return;

    const requestedPreference = normalizeAppearancePreference(value);
    const preference =
      source === "local" && !this.safeWritePreference(requestedPreference)
        ? "system"
        : requestedPreference;
    const preferenceChanged = !this.initialized || preference !== this.snapshot.preference;

    if (preferenceChanged) {
      this.unbindMediaListener();
      this.generation += 1;
    }

    const effective = this.resolveEffectiveAppearance(preference);
    const nextSnapshot: AppearanceSnapshot = { preference, effective };
    const snapshotChanged =
      nextSnapshot.preference !== this.snapshot.preference ||
      nextSnapshot.effective !== this.snapshot.effective;

    this.writeAttributeIfChanged("data-theme-preference", preference);
    this.writeAttributeIfChanged("data-theme", effective);
    if (snapshotChanged) this.snapshot = nextSnapshot;
    this.initialized = true;

    if (preferenceChanged && preference === "system") {
      this.bindMediaListener();
    }

    if (snapshotChanged) {
      for (const subscriber of this.subscribers) subscriber();
    }
  };

  private readonly handleStorageChange = (value: string | null): void => {
    this.applyPreference(normalizeAppearancePreference(value), "storage");
  };

  private safeReadPreference(): AppearancePreference {
    try {
      return normalizeAppearancePreference(this.environment?.readStoredPreference());
    } catch {
      return "system";
    }
  }

  private safeWritePreference(preference: AppearancePreference): boolean {
    try {
      this.environment?.writeStoredPreference(preference);
      return true;
    } catch {
      return false;
    }
  }

  private safeGetMediaQuery(): AppearanceMediaQuery | null {
    try {
      return this.environment?.getMediaQuery() ?? null;
    } catch {
      return null;
    }
  }

  private resolveEffectiveAppearance(preference: AppearancePreference): EffectiveAppearance {
    if (preference !== "system") return preference;
    return this.mediaQuery?.matches === true ? "dark" : "light";
  }

  private writeAttributeIfChanged(name: string, value: string): void {
    const root = this.environment?.documentElement;
    if (root !== undefined && root.getAttribute(name) !== value) {
      root.setAttribute(name, value);
    }
  }

  private bindMediaListener(): void {
    if (this.mediaQuery === null || this.mediaListener !== null) return;

    const listenerGeneration = this.generation;
    const listener = () => {
      if (
        listenerGeneration !== this.generation ||
        this.snapshot.preference !== "system"
      ) {
        return;
      }
      this.applyPreference("system", "media");
    };

    try {
      this.mediaQuery.addEventListener("change", listener);
      this.mediaListener = listener;
    } catch {
      // The initial system value remains valid when a browser cannot subscribe.
    }
  }

  private unbindMediaListener(): void {
    if (this.mediaQuery === null || this.mediaListener === null) return;

    try {
      this.mediaQuery.removeEventListener("change", this.mediaListener);
    } catch {
      // A failed remove cannot be recovered, but the generation guard makes any stale
      // callback inert.
    }
    this.mediaListener = null;
  }
}

export const appearanceController = new AppearanceController();
