/// <reference types="vite/client" />

declare module '*?worker&inline' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

// Build-Time-Konstanten, von Vite via `define` ersetzt (siehe vite.config.ts
// und scripts/build-with-config.mjs). `TeamflowConfig` ist in
// src/config/runtime-config.ts definiert — hier bewusst als `unknown` typisiert,
// damit dieses .d.ts keine Src-Types importieren muss.
declare const __TEAMFLOW_CONFIG__: import('./src/config/runtime-config').TeamflowConfig;
declare const __TEAMFLOW_BUILD_TIME__: string;
declare const __TEAMFLOW_GIT_HASH__: string;
/**
 * Literal-Boolean-Define für Tree-Shaking von Dev-Fixtures in Prod-Builds.
 * Spiegelt `runtimeConfig.features.devFixtures`, aber als reine Konstante
 * (damit `if (__TEAMFLOW_DEV_FIXTURES__) { ... }` in Prod-Builds zu dead code wird).
 */
declare const __TEAMFLOW_DEV_FIXTURES__: boolean;

interface FileSystemDirectoryHandle {
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}

declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export function gfm(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}
