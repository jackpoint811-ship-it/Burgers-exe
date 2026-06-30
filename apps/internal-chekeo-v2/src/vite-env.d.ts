/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INTERNAL_AUTH_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
