/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_FEATURE_CONTENT?: string;
  readonly VITE_FEATURE_CREATOR?: string;
  readonly VITE_FEATURE_SUBSCRIPTION?: string;
  readonly VITE_FEATURE_MERCH?: string;
  readonly VITE_FEATURE_BOOKING?: string;
  readonly VITE_FEATURE_DASHBOARD?: string;
  readonly VITE_FEATURE_ADMIN?: string;
  readonly VITE_FEATURE_EMISSIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
